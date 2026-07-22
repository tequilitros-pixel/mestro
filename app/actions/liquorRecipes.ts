"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type CreateLiquorRecipeState = {
  error: string | null;
};

export async function createLiquorRecipeAction(
  _previousState: CreateLiquorRecipeState,
  formData: FormData
): Promise<CreateLiquorRecipeState> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const productId = String(formData.get("productId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const versionText = String(formData.get("version") ?? "").trim();
  const targetLitersText = String(
    formData.get("targetLiters") ?? ""
  ).trim();
  const targetAlcoholText = String(
    formData.get("targetAlcohol") ?? ""
  ).trim();
  const instructions = normalizeOptionalText(
    formData.get("instructions")
  );
  const notes = normalizeOptionalText(formData.get("notes"));

  const version = Number(versionText);
  const targetLiters = Number(targetLitersText);

  const targetAlcohol =
    targetAlcoholText === ""
      ? null
      : Number(targetAlcoholText);

  if (!productId) {
    return {
      error: "Selecciona el producto de la receta.",
    };
  }

  if (!name) {
    return {
      error: "Escribe el nombre de la receta.",
    };
  }

  if (
    !Number.isInteger(version) ||
    version <= 0
  ) {
    return {
      error: "La versión debe ser un número entero mayor que cero.",
    };
  }

  if (
    !Number.isFinite(targetLiters) ||
    targetLiters <= 0
  ) {
    return {
      error: "El volumen base debe ser mayor que cero.",
    };
  }

  if (
    targetAlcohol !== null &&
    (!Number.isFinite(targetAlcohol) ||
      targetAlcohol < 0 ||
      targetAlcohol > 100)
  ) {
    return {
      error:
        "El alcohol objetivo debe encontrarse entre 0 y 100%.",
    };
  }

  const product = await prisma.liquorProduct.findUnique({
    where: {
      id: productId,
    },
    select: {
      id: true,
    },
  });

  if (!product) {
    return {
      error: "El producto seleccionado no existe.",
    };
  }

  try {
    const recipe = await prisma.liquorRecipe.create({
      data: {
        productId,
        name,
        version,
        targetLiters,
        targetAlcohol,
        instructions,
        notes,
        active: true,
        createdById: user.id,
      },
    });

    revalidatePath("/liquors");
    revalidatePath("/liquors/recipes");

    redirect(`/liquors/recipes/${recipe.id}`);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    const duplicatedVersion =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002";

    if (duplicatedVersion) {
      return {
        error:
          "Ese producto ya tiene una receta con la misma versión.",
      };
    }

    console.error("Error al crear receta:", error);

    return {
      error: "No fue posible guardar la receta.",
    };
  }
}

function normalizeOptionalText(
  value: FormDataEntryValue | null
) {
  const text = String(value ?? "").trim();

  return text || null;
}

function isRedirectError(error: unknown) {
  return (
    error instanceof Error &&
    error.message === "NEXT_REDIRECT"
  );
}