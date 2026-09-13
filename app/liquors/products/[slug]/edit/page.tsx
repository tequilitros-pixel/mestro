import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { ComponentType } from "react";
import { prisma } from "@/lib/prisma";
import {
  type IconProps,
  PackageIcon,
  LockIcon,
  TagIcon,
  ChartBarIcon,
} from "@/components/ui/icons";

type Props = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function EditLiquorProductPage({ params }: Props) {
  const { slug } = await params;

  const product = await prisma.liquorProduct.findUnique({
    where: {
      slug,
    },
  });

  if (!product) {
    notFound();
  }

  async function updateProduct(formData: FormData) {
    "use server";

    const productId = String(formData.get("productId") ?? "");
    const originalSlug = String(formData.get("originalSlug") ?? "");

    const name = String(formData.get("name") ?? "").trim();
    const description =
      String(formData.get("description") ?? "").trim() || null;
    const icon = String(formData.get("icon") ?? "").trim() || null;

    const defaultAlcohol = parseOptionalNumber(
      formData.get("defaultAlcohol")
    );

    const defaultShelfLifeDays = parseRequiredInteger(
      formData.get("defaultShelfLifeDays"),
      "La vida útil"
    );

    const yellowAlertDays = parseRequiredInteger(
      formData.get("yellowAlertDays"),
      "La alerta amarilla"
    );

    const redAlertDays = parseRequiredInteger(
      formData.get("redAlertDays"),
      "La alerta roja"
    );

    const showExpirationOnLabel =
      formData.get("showExpirationOnLabel") === "on";

    const requiresQr = formData.get("requiresQr") === "on";

    const requiresSerialNumber =
      formData.get("requiresSerialNumber") === "on";

    const active = formData.get("active") === "on";

    if (!productId || !originalSlug) {
      throw new Error("No fue posible identificar el producto.");
    }

    if (!name) {
      throw new Error("El nombre del producto es obligatorio.");
    }

    if (
      defaultAlcohol !== null &&
      (defaultAlcohol < 0 || defaultAlcohol > 100)
    ) {
      throw new Error(
        "El porcentaje de alcohol debe estar entre 0 y 100."
      );
    }

    if (defaultShelfLifeDays <= 0) {
      throw new Error("La vida útil debe ser mayor que cero.");
    }

    if (yellowAlertDays <= 0) {
      throw new Error(
        "Los días de alerta amarilla deben ser mayores que cero."
      );
    }

    if (redAlertDays <= 0) {
      throw new Error(
        "Los días de alerta roja deben ser mayores que cero."
      );
    }

    if (yellowAlertDays > defaultShelfLifeDays) {
      throw new Error(
        "La alerta amarilla no puede ser mayor que la vida útil."
      );
    }

    if (redAlertDays > yellowAlertDays) {
      throw new Error(
        "La alerta roja no puede ser mayor que la alerta amarilla."
      );
    }

    await prisma.liquorProduct.update({
      where: {
        id: productId,
      },
      data: {
        name,
        description,
        icon,
        defaultAlcohol,
        defaultShelfLifeDays,
        yellowAlertDays,
        redAlertDays,
        showExpirationOnLabel,
        requiresQr,
        requiresSerialNumber,
        active,
      },
    });

    revalidatePath("/liquors");
    revalidatePath(`/liquors/products/${originalSlug}`);

    redirect(`/liquors/products/${originalSlug}`);
  }

  return (
    <section className="mx-auto max-w-5xl">
      <Link
        href={`/liquors/products/${product.slug}`}
        className="text-sm font-semibold text-on-surface-variant transition hover:text-on-surface"
      >
        ← Regresar a {product.name}
      </Link>

      <header className="mt-6 rounded-3xl border border-outline-variant bg-surface-container p-6 sm:p-8">
        <p className="font-mono text-sm font-semibold uppercase tracking-[0.35em] text-on-surface-variant">
          MAESTRO 3.0
        </p>

        <div className="mt-4 flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-outline-variant bg-surface-container-high text-4xl">
            {product.icon ?? "🍹"}
          </div>

          <div>
            <h1 className="text-3xl font-black text-on-surface sm:text-4xl">
              Configurar {product.name}
            </h1>

            <p className="mt-2 max-w-2xl text-on-surface-variant">
              Define las reglas de elaboración, caducidad, etiquetado y
              trazabilidad que se aplicarán a las próximas botellas.
            </p>
          </div>
        </div>
      </header>

      <form action={updateProduct} className="mt-6 space-y-6">
        <input type="hidden" name="productId" value={product.id} />
        <input
          type="hidden"
          name="originalSlug"
          value={product.slug}
        />

        <FormSection
          eyebrow="Configuración general"
          title="Información del producto"
          description="Datos principales utilizados en producción, recetas y reportes."
        >
          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label="Nombre del producto"
              description="Nombre comercial mostrado dentro de MAESTRO."
            >
              <input
                name="name"
                type="text"
                required
                defaultValue={product.name}
                className={inputClass}
              />
            </Field>

            <Field
              label="Icono"
              description="Puedes utilizar un emoji, por ejemplo 🍓 o ☕."
            >
              <input
                name="icon"
                type="text"
                defaultValue={product.icon ?? ""}
                placeholder="🍹"
                className={inputClass}
              />
            </Field>

            <Field
              label="Alcohol por defecto"
              description="Porcentaje objetivo para nuevas elaboraciones."
            >
              <div className="relative">
                <input
                  name="defaultAlcohol"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  defaultValue={product.defaultAlcohol ?? ""}
                  placeholder="16"
                  className={`${inputClass} pr-12`}
                />

                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center font-semibold text-outline">
                  %
                </span>
              </div>
            </Field>

            <Field
              label="Estado del producto"
              description="Los productos inactivos no deben usarse en producciones nuevas."
            >
              <ToggleCard
                name="active"
                defaultChecked={product.active}
                title="Producto activo"
                description="Permitir nuevas recetas, lotes y embotellados."
              />
            </Field>
          </div>

          <div className="mt-5">
            <Field
              label="Descripción"
              description="Información general para identificar el producto."
            >
              <textarea
                name="description"
                rows={4}
                defaultValue={product.description ?? ""}
                placeholder="Descripción del producto..."
                className={inputClass}
              />
            </Field>
          </div>
        </FormSection>

        <FormSection
          eyebrow="Caducidad"
          title="Vida útil y niveles de alerta"
          description="MAESTRO utilizará estas reglas para calcular automáticamente el estado de cada botella."
        >
          <div className="grid gap-5 md:grid-cols-3">
            <Field
              label="Vida útil"
              description="Días desde la fecha de elaboración hasta la caducidad."
            >
              <NumberInput
                name="defaultShelfLifeDays"
                defaultValue={product.defaultShelfLifeDays}
                placeholder="365"
                suffix="días"
              />
            </Field>

            <Field
              label="Alerta amarilla"
              description="Aviso preventivo antes del vencimiento."
            >
              <NumberInput
                name="yellowAlertDays"
                defaultValue={product.yellowAlertDays}
                placeholder="30"
                suffix="días"
              />
            </Field>

            <Field
              label="Alerta roja"
              description="Producto con venta prioritaria."
            >
              <NumberInput
                name="redAlertDays"
                defaultValue={product.redAlertDays}
                placeholder="7"
                suffix="días"
              />
            </Field>
          </div>

          <div className="mt-5 rounded-2xl border border-on-surface-variant/20 bg-on-surface-variant/10 p-5">
            <p className="font-bold text-on-surface-variant">
              Ejemplo con la configuración actual
            </p>

            <p className="mt-2 text-sm leading-6 text-on-surface-variant/70">
              Una botella elaborada hoy caducará después de{" "}
              <strong>
                {product.defaultShelfLifeDays ?? "los días indicados"}
              </strong>
              . Entrará en alerta amarilla cuando falten{" "}
              <strong>{product.yellowAlertDays} días</strong> y en
              alerta roja cuando falten{" "}
              <strong>{product.redAlertDays} días</strong>.
            </p>
          </div>
        </FormSection>

        <FormSection
          eyebrow="Etiquetado"
          title="Información visible en la botella"
          description="Controla la información generada durante el embotellado."
        >
          <div className="grid gap-4 md:grid-cols-3">
            <ToggleCard
              name="showExpirationOnLabel"
              defaultChecked={product.showExpirationOnLabel}
              title="Mostrar caducidad"
              description="Imprimir la fecha de caducidad en la etiqueta."
            />

            <ToggleCard
              name="requiresQr"
              defaultChecked={product.requiresQr}
              title="Código QR obligatorio"
              description="Generar identidad digital individual."
            />

            <ToggleCard
              name="requiresSerialNumber"
              defaultChecked={product.requiresSerialNumber}
              title="Número de serie"
              description="Asignar consecutivo único a cada botella."
            />
          </div>
        </FormSection>

        <FormSection
          eyebrow="Trazabilidad"
          title="Cómo funcionarán estas reglas"
          description="La configuración se copiará a cada botella durante el embotellado."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <InformationCard
              icon={PackageIcon}
              title="Producciones futuras"
              description="Los cambios se aplicarán únicamente a las botellas generadas después de guardar esta configuración."
            />

            <InformationCard
              icon={LockIcon}
              title="Historial protegido"
              description="Las botellas existentes conservarán la vida útil y las alertas originales con las que fueron elaboradas."
            />

            <InformationCard
              icon={TagIcon}
              title="Etiqueta automática"
              description="MAESTRO podrá generar lote, serie, elaboración, caducidad, autenticidad y QR."
            />

            <InformationCard
              icon={ChartBarIcon}
              title="Alertas inteligentes"
              description="El dashboard podrá ordenar las botellas usando FEFO: primero en caducar, primero en salir."
            />
          </div>
        </FormSection>

        <div className="sticky bottom-4 z-20 flex flex-col-reverse gap-3 rounded-2xl border border-outline-variant bg-background/95 p-4 shadow-2xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-outline">
            Los cambios afectarán las próximas producciones.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/liquors/products/${product.slug}`}
              className="rounded-xl border border-outline-variant px-5 py-3 text-center font-bold text-on-surface-variant transition hover:border-outline-variant hover:text-on-surface"
            >
              Cancelar
            </Link>

            <button
              type="submit"
              className="rounded-xl bg-primary px-6 py-3 font-bold text-on-surface transition duration-150 ease-out hover:opacity-90 hover:scale-[1.04] active:scale-[0.97]"
            >
              Guardar configuración
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

function FormSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-outline-variant bg-surface-container p-6 sm:p-8">
      <p className="font-mono text-sm font-semibold uppercase tracking-[0.3em] text-on-surface-variant">
        {eyebrow}
      </p>

      <h2 className="mt-2 text-2xl font-bold text-on-surface">{title}</h2>

      <p className="mt-2 max-w-3xl text-sm leading-6 text-on-surface-variant">
        {description}
      </p>

      <div className="mt-6">{children}</div>
    </section>
  );
}

function Field({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-on-surface-variant">{label}</span>

      {description && (
        <span className="mt-1 block text-xs leading-5 text-outline">
          {description}
        </span>
      )}

      <span className="mt-3 block">{children}</span>
    </label>
  );
}

function NumberInput({
  name,
  defaultValue,
  placeholder,
  suffix,
}: {
  name: string;
  defaultValue: number | null;
  placeholder: string;
  suffix: string;
}) {
  return (
    <div className="relative">
      <input
        name={name}
        type="number"
        min="1"
        step="1"
        required
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className={`${inputClass} pr-20`}
      />

      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-semibold text-outline">
        {suffix}
      </span>
    </div>
  );
}

function ToggleCard({
  name,
  defaultChecked,
  title,
  description,
}: {
  name: string;
  defaultChecked: boolean;
  title: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-4 rounded-2xl border border-outline-variant bg-background/50 p-5 transition hover:border-primary/25">
      <input
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="mt-1 h-5 w-5 shrink-0 accent-primary"
      />

      <span>
        <span className="block font-bold text-on-surface">{title}</span>

        <span className="mt-1 block text-sm leading-5 text-outline">
          {description}
        </span>
      </span>
    </label>
  );
}

function InformationCard({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<IconProps>;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-background/50 p-5">
      <Icon className="h-6 w-6 text-on-surface-variant" />

      <p className="mt-3 font-bold text-on-surface">{title}</p>

      <p className="mt-2 text-sm leading-6 text-outline">
        {description}
      </p>
    </div>
  );
}

function parseOptionalNumber(value: FormDataEntryValue | null) {
  if (value === null || value === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error("Uno de los valores numéricos no es válido.");
  }

  return parsed;
}

function parseRequiredInteger(
  value: FormDataEntryValue | null,
  fieldName: string
) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new Error(`${fieldName} debe ser un número entero.`);
  }

  return parsed;
}

const inputClass =
  "resize-none w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary";