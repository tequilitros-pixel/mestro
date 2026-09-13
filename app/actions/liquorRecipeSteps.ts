"use server";

import { LiquorStepType, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type LiquorRecipeStepState = {
  success: boolean;
  error: string | null;
};

export const initialLiquorRecipeStepState: LiquorRecipeStepState = {
  success: false,
  error: null,
};

const VALID_STEP_TYPES = new Set<LiquorStepType>(
  Object.values(LiquorStepType)
);

export async function saveLiquorRecipeStepAction(
  _previousState: LiquorRecipeStepState,
  formData: FormData
): Promise<LiquorRecipeStepState> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      success: false,
      error: "Tu sesión terminó. Vuelve a iniciar sesión.",
    };
  }

  const stepId = getOptionalText(formData.get("stepId"));
  const recipeId = getRequiredText(formData.get("recipeId"));
  const typeText = getRequiredText(formData.get("type"));
  const title = getRequiredText(formData.get("title"));
  const instruction = getOptionalText(formData.get("instruction"));
  const recipeIngredientId = getOptionalText(
    formData.get("recipeIngredientId")
  );
  const measurementLabel = getOptionalText(
    formData.get("measurementLabel")
  );
  const measurementUnit = getOptionalText(
    formData.get("measurementUnit")
  );

  const durationResult = parseOptionalNonNegativeNumber(
    formData.get("durationMinutes"),
    "La duración"
  );

  if (!durationResult.success) {
    return {
      success: false,
      error: durationResult.error,
    };
  }

  const minimumResult = parseOptionalNumber(
    formData.get("minimumValue"),
    "El valor mínimo"
  );

  if (!minimumResult.success) {
    return {
      success: false,
      error: minimumResult.error,
    };
  }

  const maximumResult = parseOptionalNumber(
    formData.get("maximumValue"),
    "El valor máximo"
  );

  if (!maximumResult.success) {
    return {
      success: false,
      error: maximumResult.error,
    };
  }

  if (!recipeId) {
    return {
      success: false,
      error: "No se recibió la receta.",
    };
  }

  if (!title) {
    return {
      success: false,
      error: "Escribe el nombre del paso.",
    };
  }

  if (!VALID_STEP_TYPES.has(typeText as LiquorStepType)) {
    return {
      success: false,
      error: "Selecciona un tipo de paso válido.",
    };
  }

  const type = typeText as LiquorStepType;
  const required = formData.get("required") === "on";
  const active = formData.get("active") !== "off";

  const actions = parseLineList(formData.get("actions"));
  const checks = parseLineList(formData.get("checks"));

  const minimumValue = minimumResult.value;
  const maximumValue = maximumResult.value;
  const durationMinutes = durationResult.value;

  if (
    minimumValue !== null &&
    maximumValue !== null &&
    minimumValue > maximumValue
  ) {
    return {
      success: false,
      error: "El valor mínimo no puede ser mayor que el máximo.",
    };
  }

  if (type === LiquorStepType.INGREDIENT && !recipeIngredientId) {
    return {
      success: false,
      error: "Selecciona el ingrediente relacionado con este paso.",
    };
  }

  if (
    type === LiquorStepType.MEASUREMENT &&
    !measurementLabel
  ) {
    return {
      success: false,
      error: "Escribe qué se medirá en este paso.",
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

  if (recipeIngredientId) {
    const ingredient =
      await prisma.liquorRecipeIngredient.findFirst({
        where: {
          id: recipeIngredientId,
          recipeId,
        },
        select: {
          id: true,
        },
      });

    if (!ingredient) {
      return {
        success: false,
        error:
          "El ingrediente seleccionado no pertenece a esta receta.",
      };
    }
  }

  try {
    if (stepId) {
      const existingStep =
        await prisma.liquorRecipeStep.findFirst({
          where: {
            id: stepId,
            recipeId,
          },
          select: {
            id: true,
          },
        });

      if (!existingStep) {
        return {
          success: false,
          error: "El paso que intentas editar ya no existe.",
        };
      }

      await prisma.liquorRecipeStep.update({
        where: {
          id: stepId,
        },
        data: {
          type,
          title,
          instruction,
          actions,
          checks,
          recipeIngredientId,
          durationMinutes,
          measurementLabel,
          measurementUnit,
          minimumValue,
          maximumValue,
          required,
          active,
        },
      });
    } else {
      const lastStep = await prisma.liquorRecipeStep.findFirst({
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

      const nextPosition = (lastStep?.position ?? 0) + 1;

      await prisma.liquorRecipeStep.create({
        data: {
          recipeId,
          position: nextPosition,
          type,
          title,
          instruction,
          actions,
          checks,
          recipeIngredientId,
          durationMinutes,
          measurementLabel,
          measurementUnit,
          minimumValue,
          maximumValue,
          required,
          active,
        },
      });
    }

    revalidateRecipePaths(recipeId);

    return {
      success: true,
      error: null,
    };
  } catch (error) {
    console.error("Error al guardar paso de receta:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return {
        success: false,
        error:
          "No fue posible relacionar el paso con la receta o ingrediente.",
      };
    }

    return {
      success: false,
      error: "No fue posible guardar el paso.",
    };
  }
}

export async function deleteLiquorRecipeStepAction(
  formData: FormData
): Promise<void> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("No autorizado.");
  }

  const recipeId = getRequiredText(formData.get("recipeId"));
  const stepId = getRequiredText(formData.get("stepId"));

  if (!recipeId || !stepId) {
    throw new Error("No se recibió el paso que será eliminado.");
  }

  const step = await prisma.liquorRecipeStep.findFirst({
    where: {
      id: stepId,
      recipeId,
    },
    select: {
      id: true,
    },
  });

  if (!step) {
    throw new Error("El paso ya no existe.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.liquorRecipeStep.delete({
      where: {
        id: stepId,
      },
    });

    await normalizeStepPositions(tx, recipeId);
  });

  revalidateRecipePaths(recipeId);
}

export async function moveLiquorRecipeStepUpAction(
  formData: FormData
): Promise<void> {
  await moveLiquorRecipeStep(formData, "up");
}

export async function moveLiquorRecipeStepDownAction(
  formData: FormData
): Promise<void> {
  await moveLiquorRecipeStep(formData, "down");
}

export async function toggleLiquorRecipeStepAction(
  formData: FormData
): Promise<void> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("No autorizado.");
  }

  const recipeId = getRequiredText(formData.get("recipeId"));
  const stepId = getRequiredText(formData.get("stepId"));

  if (!recipeId || !stepId) {
    throw new Error("No se recibió el paso.");
  }

  const step = await prisma.liquorRecipeStep.findFirst({
    where: {
      id: stepId,
      recipeId,
    },
    select: {
      id: true,
      active: true,
    },
  });

  if (!step) {
    throw new Error("El paso ya no existe.");
  }

  await prisma.liquorRecipeStep.update({
    where: {
      id: step.id,
    },
    data: {
      active: !step.active,
    },
  });

  revalidateRecipePaths(recipeId);
}

async function moveLiquorRecipeStep(
  formData: FormData,
  direction: "up" | "down"
): Promise<void> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("No autorizado.");
  }

  const recipeId = getRequiredText(formData.get("recipeId"));
  const stepId = getRequiredText(formData.get("stepId"));

  if (!recipeId || !stepId) {
    throw new Error("No se recibió el paso que será movido.");
  }

  await prisma.$transaction(async (tx) => {
    const steps = await tx.liquorRecipeStep.findMany({
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

    const currentIndex = steps.findIndex(
      (step) => step.id === stepId
    );

    if (currentIndex === -1) {
      throw new Error("El paso ya no existe.");
    }

    const targetIndex =
      direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= steps.length) {
      return;
    }

    const reorderedSteps = [...steps];
    const [movedStep] = reorderedSteps.splice(currentIndex, 1);

    reorderedSteps.splice(targetIndex, 0, movedStep);

    for (let index = 0; index < reorderedSteps.length; index += 1) {
      await tx.liquorRecipeStep.update({
        where: {
          id: reorderedSteps[index].id,
        },
        data: {
          position: index + 1,
        },
      });
    }
  });

  revalidateRecipePaths(recipeId);
}

async function normalizeStepPositions(
  tx: Prisma.TransactionClient,
  recipeId: string
) {
  const steps = await tx.liquorRecipeStep.findMany({
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

  for (let index = 0; index < steps.length; index += 1) {
    await tx.liquorRecipeStep.update({
      where: {
        id: steps[index].id,
      },
      data: {
        position: index + 1,
      },
    });
  }
}

function parseLineList(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();

  if (!text) {
    return [];
  }

  return text
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseOptionalNumber(
  value: FormDataEntryValue | null,
  label: string
):
  | { success: true; value: number | null }
  | { success: false; error: string } {
  const text = String(value ?? "").trim();

  if (!text) {
    return {
      success: true,
      value: null,
    };
  }

  const number = Number(text);

  if (!Number.isFinite(number)) {
    return {
      success: false,
      error: `${label} debe ser un número válido.`,
    };
  }

  return {
    success: true,
    value: number,
  };
}

function parseOptionalNonNegativeNumber(
  value: FormDataEntryValue | null,
  label: string
):
  | { success: true; value: number | null }
  | { success: false; error: string } {
  const parsed = parseOptionalNumber(value, label);

  if (!parsed.success) {
    return parsed;
  }

  if (parsed.value !== null && parsed.value < 0) {
    return {
      success: false,
      error: `${label} no puede ser negativa.`,
    };
  }

  return parsed;
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