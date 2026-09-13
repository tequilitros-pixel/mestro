"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type LiquorRecipeIngredientState = {
  success: boolean;
  error: string | null;
};

export const initialLiquorRecipeIngredientState: LiquorRecipeIngredientState = {
  success: false,
  error: null,
};

/**
 * Crea o actualiza un ingrediente.
 *
 * Si formData contiene ingredientId, actualiza el ingrediente.
 * Si no contiene ingredientId, crea uno nuevo.
 */
export async function saveLiquorRecipeIngredientAction(
  _previousState: LiquorRecipeIngredientState,
  formData: FormData
): Promise<LiquorRecipeIngredientState> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      success: false,
      error: "Tu sesión terminó. Vuelve a iniciar sesión.",
    };
  }

  const ingredientId = getOptionalText(formData.get("ingredientId"));
  const recipeId = getRequiredText(formData.get("recipeId"));
  const rawMaterialId = getOptionalText(formData.get("rawMaterialId"));
  const enteredName = getRequiredText(formData.get("name"));
  const unit = getRequiredText(formData.get("unit"));
  const quantityText = getRequiredText(formData.get("quantity"));
  const notes = getOptionalText(formData.get("notes"));
  const optional = formData.get("optional") === "on";

  if (!recipeId) {
    return {
      success: false,
      error: "No se recibió la receta.",
    };
  }

  if (!enteredName) {
    return {
      success: false,
      error: "Escribe el nombre del ingrediente.",
    };
  }

  if (!unit) {
    return {
      success: false,
      error: "Selecciona o escribe la unidad del ingrediente.",
    };
  }

  const quantity = Number(quantityText);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return {
      success: false,
      error: "La cantidad debe ser mayor que cero.",
    };
  }

  const recipe = await prisma.liquorRecipe.findUnique({
    where: {
      id: recipeId,
    },
    select: {
      id: true,
    },
  });

  if (!recipe) {
    return {
      success: false,
      error: "La receta ya no existe.",
    };
  }

  let finalName = enteredName;

  if (rawMaterialId) {
    const rawMaterial = await prisma.rawMaterial.findUnique({
      where: {
        id: rawMaterialId,
      },
      select: {
        id: true,
        name: true,
        active: true,
      },
    });

    if (!rawMaterial) {
      return {
        success: false,
        error: "La materia prima seleccionada no existe.",
      };
    }

    if (!rawMaterial.active) {
      return {
        success: false,
        error: "La materia prima seleccionada está inactiva.",
      };
    }

    finalName = rawMaterial.name;
  }

  try {
    if (ingredientId) {
      const existingIngredient =
        await prisma.liquorRecipeIngredient.findFirst({
          where: {
            id: ingredientId,
            recipeId,
          },
          select: {
            id: true,
          },
        });

      if (!existingIngredient) {
        return {
          success: false,
          error: "El ingrediente que intentas editar no existe.",
        };
      }

      await prisma.liquorRecipeIngredient.update({
        where: {
          id: ingredientId,
        },
        data: {
          rawMaterialId,
          name: finalName,
          quantity,
          unit,
          optional,
          notes,
        },
      });
    } else {
      const lastIngredient =
        await prisma.liquorRecipeIngredient.findFirst({
          where: {
            recipeId,
          },
          orderBy: {
            position: "desc",
          },
          select: {
            position: true,
          },
        });

      const nextPosition = (lastIngredient?.position ?? 0) + 1;

      await prisma.liquorRecipeIngredient.create({
        data: {
          recipeId,
          rawMaterialId,
          name: finalName,
          quantity,
          unit,
          position: nextPosition,
          optional,
          notes,
        },
      });
    }

    revalidateRecipePaths(recipeId);

    return {
      success: true,
      error: null,
    };
  } catch (error) {
    console.error("Error al guardar ingrediente de receta:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return {
        success: false,
        error:
          "No fue posible relacionar la materia prima con el ingrediente.",
      };
    }

    return {
      success: false,
      error: "No fue posible guardar el ingrediente.",
    };
  }
}

/**
 * Elimina un ingrediente de una receta.
 *
 * Prisma pondrá recipeIngredientId en null en los pasos relacionados,
 * porque la relación usa onDelete: SetNull.
 */
export async function deleteLiquorRecipeIngredientAction(
  formData: FormData
): Promise<void> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("No autorizado.");
  }

  const recipeId = getRequiredText(formData.get("recipeId"));
  const ingredientId = getRequiredText(formData.get("ingredientId"));

  if (!recipeId || !ingredientId) {
    throw new Error("No se recibió el ingrediente que será eliminado.");
  }

  const ingredient = await prisma.liquorRecipeIngredient.findFirst({
    where: {
      id: ingredientId,
      recipeId,
    },
    select: {
      id: true,
    },
  });

  if (!ingredient) {
    throw new Error("El ingrediente ya no existe.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.liquorRecipeIngredient.delete({
      where: {
        id: ingredientId,
      },
    });

    await normalizeIngredientPositions(tx, recipeId);
  });

  revalidateRecipePaths(recipeId);
}

/**
 * Mueve un ingrediente una posición hacia arriba.
 */
export async function moveLiquorRecipeIngredientUpAction(
  formData: FormData
): Promise<void> {
  await moveLiquorRecipeIngredient(formData, "up");
}

/**
 * Mueve un ingrediente una posición hacia abajo.
 */
export async function moveLiquorRecipeIngredientDownAction(
  formData: FormData
): Promise<void> {
  await moveLiquorRecipeIngredient(formData, "down");
}

async function moveLiquorRecipeIngredient(
  formData: FormData,
  direction: "up" | "down"
): Promise<void> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("No autorizado.");
  }

  const recipeId = getRequiredText(formData.get("recipeId"));
  const ingredientId = getRequiredText(formData.get("ingredientId"));

  if (!recipeId || !ingredientId) {
    throw new Error("No se recibió el ingrediente que será movido.");
  }

  await prisma.$transaction(async (tx) => {
    const ingredients = await tx.liquorRecipeIngredient.findMany({
      where: {
        recipeId,
      },
      orderBy: [
        {
          position: "asc",
        },
        {
          createdAt: "asc",
        },
      ],
      select: {
        id: true,
        position: true,
      },
    });

    const currentIndex = ingredients.findIndex(
      (ingredient) => ingredient.id === ingredientId
    );

    if (currentIndex === -1) {
      throw new Error("El ingrediente ya no existe.");
    }

    const targetIndex =
      direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= ingredients.length) {
      return;
    }

    const reorderedIngredients = [...ingredients];

    const [movedIngredient] = reorderedIngredients.splice(currentIndex, 1);
    reorderedIngredients.splice(targetIndex, 0, movedIngredient);

    for (let index = 0; index < reorderedIngredients.length; index += 1) {
      await tx.liquorRecipeIngredient.update({
        where: {
          id: reorderedIngredients[index].id,
        },
        data: {
          position: index + 1,
        },
      });
    }
  });

  revalidateRecipePaths(recipeId);
}

async function normalizeIngredientPositions(
  tx: Prisma.TransactionClient,
  recipeId: string
) {
  const ingredients = await tx.liquorRecipeIngredient.findMany({
    where: {
      recipeId,
    },
    orderBy: [
      {
        position: "asc",
      },
      {
        createdAt: "asc",
      },
    ],
    select: {
      id: true,
    },
  });

  for (let index = 0; index < ingredients.length; index += 1) {
    await tx.liquorRecipeIngredient.update({
      where: {
        id: ingredients[index].id,
      },
      data: {
        position: index + 1,
      },
    });
  }
}

function revalidateRecipePaths(recipeId: string) {
  revalidatePath("/liquors");
  revalidatePath("/liquors/recipes");
  revalidatePath(`/liquors/recipes/${recipeId}`);
}

function getRequiredText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function getOptionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();

  return text || null;
}