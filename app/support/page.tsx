"use client";

import { useState } from "react";
import Link from "next/link";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: "account" | "technical" | "security" | "privacy";
}

const faqs: FAQItem[] = [
  {
    id: "forgot-password",
    question: "¿Olvidé mi contraseña. Qué hago?",
    answer:
      "En la página de login, haz clic en '¿Olvidaste tu contraseña?' y sigue los pasos. Recibirás un email con un enlace para resetearla. El enlace es válido por 24 horas.",
    category: "account",
  },
  {
    id: "locked-account",
    question: "Mi cuenta está bloqueada. ¿Cuánto dura?",
    answer:
      "Después de 5 intentos fallidos de login, tu cuenta se bloquea por 15 minutos como medida de seguridad. Intenta de nuevo después de ese tiempo.",
    category: "security",
  },
  {
    id: "remember-device",
    question: "¿Qué significa 'Recordar este dispositivo'?",
    answer:
      "Si activas esta opción, Maestro te recordará por 30 días y no tendrás que entrar contraseña de nuevo. Es seguro en dispositivos personales. NUNCA lo hagas en dispositivos compartidos.",
    category: "security",
  },
  {
    id: "sms-login",
    question: "¿Cómo funciona el login por SMS?",
    answer:
      "Ingresa tu teléfono y recibirás un código temporal por SMS. Ese código es válido solo por 5 minutos. Es más seguro que contraseña y recomendado.",
    category: "account",
  },
  {
    id: "browser-support",
    question: "¿Qué navegadores soporta Maestro?",
    answer:
      "Chrome, Firefox, Safari y Edge en versiones recientes. Recomendamos actualizar a la última versión de tu navegador. En iOS, usa la app Capacitor. En Android, cualquier navegador moderno funciona.",
    category: "technical",
  },
  {
    id: "slow-performance",
    question: "Maestro va lento. ¿Qué puedo hacer?",
    answer:
      "1) Recarga la página (Ctrl+R o Cmd+R)\n2) Limpia el caché del navegador\n3) Verifica tu conexión internet\n4) Si usa WiFi, intenta con datos móviles\n5) Si persiste, contacta a soporte",
    category: "technical",
  },
  {
    id: "data-export",
    question: "¿Puedo descargar mis datos?",
    answer:
      "Sí, tienes derecho a exportar tus datos. Envía un email a support@maestro-destiladora.space y te lo procesaremos en máximo 30 días.",
    category: "privacy",
  },
  {
    id: "delete-account",
    question: "¿Cómo elimino mi cuenta?",
    answer:
      "Contacta a tu administrador o envía un email a support@maestro-destiladora.space. Nota: Los datos operacionales se retienen por ley por 7 años. Solo se eliminan datos personales en 30 días.",
    category: "account",
  },
  {
    id: "security-breach",
    question: "¿Qué hago si sospeche un hack?",
    answer:
      "1) Cambia tu contraseña inmediatamente\n2) Cierra sesión en todos los dispositivos\n3) Habilita SMS login si aún no lo tienes\n4) Contacta a soporte de inmediato: security@maestro-destiladora.space",
    category: "security",
  },
  {
    id: "session-expired",
    question: "¿Por qué me sacó la sesión?",
    answer:
      "Las sesiones expiran después de 8 horas de inactividad por seguridad. Si activaste 'Recordar dispositivo', se te abrirá automáticamente. Si no, tendrás que entrar de nuevo.",
    category: "account",
  },
  {
    id: "offline-mode",
    question: "¿Funciona sin internet?",
    answer:
      "Maestro requiere conexión internet. No hay modo offline disponible actualmente. Asegúrate de tener conexión estable antes de operaciones críticas.",
    category: "technical",
  },
  {
    id: "mobile-app",
    question: "¿Hay app para iOS y Android?",
    answer:
      "Maestro se accede a través de Capacitor WebView. En iOS, descarga desde App Store (próximamente). En Android, usa el navegador Chrome o la app Capacitor si está disponible.",
    category: "technical",
  },
];

const supportChannels = [
  {
    icon: "📧",
    title: "Email - General",
    email: "support@maestro-destiladora.space",
    hours: "Lunes a Viernes, 8 AM - 6 PM",
    responseTime: "24-48 horas",
    topics: "Preguntas generales, reportar bugs, sugerencias",
  },
  {
    icon: "🔒",
    title: "Email - Seguridad",
    email: "security@maestro-destiladora.space",
    hours: "24/7 (urgente)",
    responseTime: "2-4 horas",
    topics: "Brechas de seguridad, vulnerabilidades, hacks",
  },
  {
    icon: "👤",
    title: "Email - Privacidad",
    email: "privacy@maestro-destiladora.space",
    hours: "Lunes a Viernes, 8 AM - 6 PM",
    responseTime: "30 días (por ley)",
    topics: "GDPR/CCPA, acceso a datos, derechos de usuario",
  },
  {
    icon: "👨‍💼",
    title: "Tu Administrador Local",
    email: "Pregunta en tu sucursal",
    hours: "Horario de trabajo",
    responseTime: "Inmediato",
    topics: "Permisos, acceso, preguntas operacionales",
  },
];

export default function SupportPage() {
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<"all" | "account" | "technical" | "security" | "privacy">("all");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    category: "general",
    subject: "",
    message: "",
  });
  const [submitStatus, setSubmitStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const filteredFaqs =
    selectedCategory === "all"
      ? faqs
      : faqs.filter((faq) => faq.category === selectedCategory);

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitStatus("loading");

    try {
      // Simulamos envío - en producción, usar API real
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Aquí iría el envío real a una API
      console.log("Formulario enviado:", formData);

      setSubmitStatus("success");
      setFormData({
        name: "",
        email: "",
        category: "general",
        subject: "",
        message: "",
      });

      setTimeout(() => setSubmitStatus("idle"), 5000);
    } catch (error) {
      console.error("Error al enviar:", error);
      setSubmitStatus("error");
      setTimeout(() => setSubmitStatus("idle"), 5000);
    }
  };

  return (
    <main className="min-h-screen bg-surface">
      {/* Header */}
      <header className="border-b border-outline-variant bg-surface-container">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <Link
            href="/login"
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-primary hover:opacity-80 transition"
          >
            ← Volver al inicio
          </Link>
          <h1 className="text-4xl font-bold text-primary">Centro de Soporte</h1>
          <p className="mt-2 text-on-surface-variant">
            Aquí encontrarás respuestas a preguntas frecuentes y cómo contactar a nuestro equipo
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Quick Links */}
        <section className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/privacy-policy"
            className="rounded-lg border border-outline-variant bg-surface-container-low p-4 hover:bg-surface-container transition"
          >
            <p className="text-lg mb-2">📋</p>
            <p className="font-semibold text-on-surface">Política de Privacidad</p>
            <p className="text-xs text-on-surface-variant mt-1">Cómo protegemos tus datos</p>
          </Link>

          <Link
            href="/terms-of-service"
            className="rounded-lg border border-outline-variant bg-surface-container-low p-4 hover:bg-surface-container transition"
          >
            <p className="text-lg mb-2">⚖️</p>
            <p className="font-semibold text-on-surface">Términos de Servicio</p>
            <p className="text-xs text-on-surface-variant mt-1">Nuestros términos legales</p>
          </Link>

          <a
            href="mailto:security@maestro-destiladora.space"
            className="rounded-lg border border-outline-variant bg-surface-container-low p-4 hover:bg-surface-container transition"
          >
            <p className="text-lg mb-2">🔒</p>
            <p className="font-semibold text-on-surface">Reportar Seguridad</p>
            <p className="text-xs text-on-surface-variant mt-1">Vulnerabilidad encontrada</p>
          </a>

          <a
            href="mailto:support@maestro-destiladora.space"
            className="rounded-lg border border-outline-variant bg-surface-container-low p-4 hover:bg-surface-container transition"
          >
            <p className="text-lg mb-2">📧</p>
            <p className="font-semibold text-on-surface">Contactar Soporte</p>
            <p className="text-xs text-on-surface-variant mt-1">Obtener ayuda directa</p>
          </a>
        </section>

        {/* Canales de Soporte */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-primary mb-6">📞 Canales de Contacto</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {supportChannels.map((channel) => (
              <div
                key={channel.email}
                className="rounded-lg border border-outline-variant bg-surface-container-low p-6"
              >
                <p className="text-3xl mb-2">{channel.icon}</p>
                <h3 className="text-lg font-semibold text-on-surface mb-4">
                  {channel.title}
                </h3>
                <div className="space-y-2 text-sm text-on-surface-variant">
                  <p>
                    <strong>Email:</strong>{" "}
                    <a
                      href={`mailto:${channel.email}`}
                      className="text-primary hover:underline"
                    >
                      {channel.email}
                    </a>
                  </p>
                  <p>
                    <strong>Horario:</strong> {channel.hours}
                  </p>
                  <p>
                    <strong>Respuesta:</strong> {channel.responseTime}
                  </p>
                  <p>
                    <strong>Temas:</strong> {channel.topics}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Formulario de Contacto */}
        <section className="mb-12 rounded-lg border border-outline-variant bg-surface-container-low p-8">
          <h2 className="text-2xl font-bold text-primary mb-6">✉️ Formulario de Contacto</h2>

          {submitStatus === "success" && (
            <div className="mb-6 rounded-lg border border-tertiary-fixed-dim/30 bg-tertiary-fixed-dim/10 p-4 text-tertiary-fixed-dim">
              ✓ Tu mensaje fue enviado exitosamente. Nos pondremos en contacto en 24-48 horas.
            </div>
          )}

          {submitStatus === "error" && (
            <div className="mb-6 rounded-lg border border-error/30 bg-error/10 p-4 text-error">
              ✗ Error al enviar mensaje. Por favor intenta de nuevo o contacta directamente.
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-on-surface">
                  Nombre *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleFormChange}
                  required
                  placeholder="Tu nombre completo"
                  className="w-full rounded-lg border border-outline-variant bg-surface-dim/60 px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-on-surface">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleFormChange}
                  required
                  placeholder="tu@email.com"
                  className="w-full rounded-lg border border-outline-variant bg-surface-dim/60 px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-on-surface">
                Categoría *
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleFormChange}
                className="w-full rounded-lg border border-outline-variant bg-surface-dim/60 px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
              >
                <option value="general">General</option>
                <option value="technical">Problema Técnico</option>
                <option value="security">Seguridad</option>
                <option value="privacy">Privacidad</option>
                <option value="bug">Reportar Bug</option>
                <option value="feature">Solicitud de Función</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-on-surface">
                Asunto *
              </label>
              <input
                type="text"
                name="subject"
                value={formData.subject}
                onChange={handleFormChange}
                required
                placeholder="Resumen corto del problema"
                className="w-full rounded-lg border border-outline-variant bg-surface-dim/60 px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-on-surface">
                Mensaje *
              </label>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleFormChange}
                required
                placeholder="Describe tu problema o pregunta en detalle. Incluye pasos si es un bug."
                rows={6}
                className="w-full rounded-lg border border-outline-variant bg-surface-dim/60 px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitStatus === "loading"}
              className="w-full rounded-lg bg-primary py-3 font-bold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97] disabled:opacity-50 disabled:hover:scale-100"
            >
              {submitStatus === "loading" ? "Enviando..." : "Enviar Mensaje"}
            </button>
          </form>

          <p className="mt-4 text-xs text-on-surface-variant">
            * Campos obligatorios. Responderemos en máximo 48 horas a tu email.
          </p>
        </section>

        {/* FAQs */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-primary mb-6">❓ Preguntas Frecuentes</h2>

          {/* Filtros */}
          <div className="mb-6 flex flex-wrap gap-2">
            {[
              { value: "all", label: "Todas" },
              { value: "account", label: "Cuenta" },
              { value: "technical", label: "Técnico" },
              { value: "security", label: "Seguridad" },
              { value: "privacy", label: "Privacidad" },
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() =>
                  setSelectedCategory(
                    filter.value as "all" | "account" | "technical" | "security" | "privacy"
                  )
                }
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  selectedCategory === filter.value
                    ? "bg-primary text-on-primary"
                    : "border border-outline-variant bg-surface-container-low text-on-surface hover:border-primary"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* FAQs List */}
          <div className="space-y-3">
            {filteredFaqs.map((faq) => (
              <div
                key={faq.id}
                className="rounded-lg border border-outline-variant bg-surface-container-low overflow-hidden"
              >
                <button
                  onClick={() =>
                    setExpandedFaq(expandedFaq === faq.id ? null : faq.id)
                  }
                  className="w-full px-6 py-4 text-left font-semibold text-on-surface hover:bg-surface-container transition flex items-center justify-between"
                >
                  <span>{faq.question}</span>
                  <span
                    className={`text-primary transition-transform ${
                      expandedFaq === faq.id ? "rotate-180" : ""
                    }`}
                  >
                    ▼
                  </span>
                </button>

                {expandedFaq === faq.id && (
                  <div className="border-t border-outline-variant px-6 py-4 text-on-surface-variant whitespace-pre-wrap">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>

          {filteredFaqs.length === 0 && (
            <div className="rounded-lg border border-outline-variant bg-surface-container-low p-6 text-center text-on-surface-variant">
              No hay preguntas frecuentes en esta categoría.
            </div>
          )}
        </section>

        {/* Status Page */}
        <section className="mb-12 rounded-lg border border-outline-variant bg-surface-container-low p-8">
          <h2 className="text-2xl font-bold text-primary mb-6">📊 Estado del Servicio</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-outline-variant p-4 bg-surface-dim/30">
              <div>
                <p className="font-semibold text-on-surface">Maestro - Plataforma Principal</p>
                <p className="text-sm text-on-surface-variant">maestro-destiladora.space</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500"></div>
                <span className="text-sm font-semibold text-green-500">Operativo</span>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-outline-variant p-4 bg-surface-dim/30">
              <div>
                <p className="font-semibold text-on-surface">Base de Datos</p>
                <p className="text-sm text-on-surface-variant">PostgreSQL - Neon</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500"></div>
                <span className="text-sm font-semibold text-green-500">Operativo</span>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-outline-variant p-4 bg-surface-dim/30">
              <div>
                <p className="font-semibold text-on-surface">Email (Soporte)</p>
                <p className="text-sm text-on-surface-variant">support@maestro-destiladora.space</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500"></div>
                <span className="text-sm font-semibold text-green-500">Operativo</span>
              </div>
            </div>
          </div>

          <p className="mt-6 text-xs text-on-surface-variant">
            Último actualizado: Ahora | Próxima verificación: En 5 minutos
          </p>
        </section>

        {/* Footer Links */}
        <section className="border-t border-outline-variant pt-8">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <h3 className="font-semibold text-on-surface mb-2">Documentos</h3>
              <ul className="space-y-1 text-sm text-on-surface-variant">
                <li>
                  <Link href="/privacy-policy" className="hover:text-primary transition">
                    Política de Privacidad
                  </Link>
                </li>
                <li>
                  <Link href="/terms-of-service" className="hover:text-primary transition">
                    Términos de Servicio
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-on-surface mb-2">Contacto Directo</h3>
              <ul className="space-y-1 text-sm text-on-surface-variant">
                <li>
                  <a
                    href="mailto:support@maestro-destiladora.space"
                    className="hover:text-primary transition"
                  >
                    Soporte General
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:security@maestro-destiladora.space"
                    className="hover:text-primary transition"
                  >
                    Seguridad
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-on-surface mb-2">Información</h3>
              <ul className="space-y-1 text-sm text-on-surface-variant">
                <li>Destiladora del Norte</li>
                <li>Jalisco, México</li>
                <li>© 2026 Todos los derechos reservados</li>
              </ul>
            </div>
          </div>
        </section>
      </div>

      {/* Back Button */}
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/login"
          className="text-center text-sm font-medium text-primary hover:opacity-80 transition block"
        >
          ← Volver al login
        </Link>
      </div>
    </main>
  );
}
