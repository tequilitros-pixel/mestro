import Link from "next/link";

export const metadata = {
  title: "Política de Privacidad - Maestro",
  description:
    "Política de privacidad de la aplicación Maestro de Destiladora del Norte",
};

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-surface">
      {/* Header */}
      <header className="border-b border-outline-variant bg-surface-container">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <Link
            href="/login"
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-primary hover:opacity-80 transition"
          >
            ← Volver al inicio
          </Link>
          <h1 className="text-4xl font-bold text-primary">Política de Privacidad</h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            Última actualización: 14 de agosto de 2026
          </p>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="prose prose-invert max-w-none space-y-8 text-on-surface">
          {/* Intro */}
          <section className="rounded-lg border border-outline-variant bg-surface-container-low p-6">
            <p className="text-lg leading-relaxed">
              En <strong>Destiladora del Norte</strong>, respetamos tu privacidad y
              nos comprometemos a proteger tus datos personales. Esta política
              explica cómo recolectamos, usamos, almacenamos y compartimos tu
              información cuando usas <strong>Maestro</strong>.
            </p>
          </section>

          {/* 1. Información que Recolectamos */}
          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">
              1. Información que Recolectamos
            </h2>

            <div className="space-y-4">
              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
                <h3 className="font-semibold text-on-surface mb-2">
                  📋 Información de Autenticación
                </h3>
                <ul className="space-y-2 ml-4 text-on-surface-variant">
                  <li>• Nombre de usuario único</li>
                  <li>• Correo electrónico (opcional)</li>
                  <li>• Número de teléfono (para autenticación SMS)</li>
                  <li>• Contraseña hasheada con bcrypt</li>
                  <li>• PIN numérico (para acceso a kiosco)</li>
                </ul>
              </div>

              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
                <h3 className="font-semibold text-on-surface mb-2">
                  🏭 Información Operacional
                </h3>
                <ul className="space-y-2 ml-4 text-on-surface-variant">
                  <li>• Actividad de producción (lotes, fermentación, destilación)</li>
                  <li>• Inventario y movimiento de productos</li>
                  <li>• Transacciones de punto de venta (POS)</li>
                  <li>• Arqueos de caja y movimientos de efectivo</li>
                  <li>• Registro de entrada/salida (timeclock)</li>
                  <li>• Información de sucursal asignada</li>
                  <li>• Permisos y roles de usuario</li>
                </ul>
              </div>

              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
                <h3 className="font-semibold text-on-surface mb-2">
                  🔧 Información Técnica
                </h3>
                <ul className="space-y-2 ml-4 text-on-surface-variant">
                  <li>• Dirección IP del dispositivo</li>
                  <li>• Tipo y versión de navegador</li>
                  <li>• Sistema operativo (iOS, Android, macOS, Windows)</li>
                  <li>• ID de dispositivo</li>
                  <li>• Información de conexión (WiFi, celular)</li>
                  <li>• Timestamps de acceso y actividad</li>
                </ul>
              </div>

              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
                <h3 className="font-semibold text-on-surface mb-2">
                  📍 Información de Ubicación (si aplica)
                </h3>
                <ul className="space-y-2 ml-4 text-on-surface-variant">
                  <li>• Ubicación GPS (solo si otorgas permiso explícito)</li>
                  <li>• Geofences de sucursales</li>
                  <li>• Historial de ubicación para auditoría</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 2. Cómo Usamos Tu Información */}
          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">
              2. Cómo Usamos Tu Información
            </h2>

            <div className="space-y-3">
              <div className="flex gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-4">
                <span className="text-lg">🔐</span>
                <div>
                  <p className="font-semibold text-on-surface">Autenticación y Seguridad</p>
                  <p className="text-sm text-on-surface-variant">
                    Verificar identidad, prevenir acceso no autorizado, implementar
                    rate limiting contra ataques de fuerza bruta.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-4">
                <span className="text-lg">📊</span>
                <div>
                  <p className="font-semibold text-on-surface">Operaciones Comerciales</p>
                  <p className="text-sm text-on-surface-variant">
                    Procesar transacciones, registrar producción, mantener inventario,
                    calcular nómina y realizar auditorías.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-4">
                <span className="text-lg">📋</span>
                <div>
                  <p className="font-semibold text-on-surface">Auditoría y Cumplimiento</p>
                  <p className="text-sm text-on-surface-variant">
                    Mantener logs de acceso, rastrear cambios críticos, detectar
                    actividades sospechosas, cumplir con leyes fiscales.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-4">
                <span className="text-lg">🔧</span>
                <div>
                  <p className="font-semibold text-on-surface">Mejora de Servicios</p>
                  <p className="text-sm text-on-surface-variant">
                    Optimizar funcionalidad, identificar y resolver errores,
                    analizar uso de características.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-4">
                <span className="text-lg">📧</span>
                <div>
                  <p className="font-semibold text-on-surface">Comunicaciones</p>
                  <p className="text-sm text-on-surface-variant">
                    Notificaciones de cambios, alertas de seguridad, recuperación
                    de cuenta, cambios de política.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* 3. Base Legal para el Procesamiento */}
          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">
              3. Base Legal para el Procesamiento
            </h2>

            <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5 space-y-3">
              <p>
                Procesamos tu información bajo las siguientes bases legales:
              </p>
              <ul className="space-y-2 ml-4">
                <li>
                  <strong>Ejecución de Contrato:</strong> Para proporcionar los
                  servicios de Maestro bajo tu acuerdo laboral con Destiladora del
                  Norte.
                </li>
                <li>
                  <strong>Obligación Legal:</strong> Para cumplir con leyes fiscales,
                  laborales y de auditoría en México.
                </li>
                <li>
                  <strong>Interés Legítimo:</strong> Para asegurar la seguridad de
                  la plataforma, prevenir fraude y mantener registros operacionales.
                </li>
                <li>
                  <strong>Consentimiento:</strong> Para funciones opcionales como
                  notificaciones push o ubicación.
                </li>
              </ul>
            </div>
          </section>

          {/* 4. Almacenamiento y Seguridad */}
          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">
              4. Almacenamiento y Seguridad
            </h2>

            <div className="space-y-4">
              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
                <h3 className="font-semibold text-on-surface mb-3">🔒 Medidas de Seguridad</h3>
                <ul className="space-y-2 ml-4 text-on-surface-variant">
                  <li>
                    <strong>Encriptación en Tránsito:</strong> HTTPS/TLS 1.3 para
                    todas las comunicaciones
                  </li>
                  <li>
                    <strong>Encriptación de Contraseñas:</strong> Bcrypt con salt
                    (no almacenamos texto plano)
                  </li>
                  <li>
                    <strong>Base de Datos:</strong> PostgreSQL en Neon con SSL,
                    backups automáticos
                  </li>
                  <li>
                    <strong>Control de Acceso:</strong> Autenticación por roles
                    (ADMIN, OPERATOR)
                  </li>
                  <li>
                    <strong>Rate Limiting:</strong> Bloqueo temporal tras intentos
                    fallidos
                  </li>
                  <li>
                    <strong>Logs de Auditoría:</strong> Registro de todos los
                    cambios críticos
                  </li>
                  <li>
                    <strong>Cookies Seguras:</strong> HttpOnly, Secure, SameSite
                    flags
                  </li>
                </ul>
              </div>

              <div className="rounded-lg border border-tertiary-fixed-dim/20 bg-tertiary-fixed-dim/5 p-5">
                <h3 className="font-semibold text-tertiary-fixed-dim mb-2">
                  ⚠️ Limitaciones de Seguridad
                </h3>
                <p className="text-sm text-on-surface-variant">
                  Aunque implementamos medidas de seguridad sólidas, ningún sistema
                  es 100% seguro. No podemos garantizar seguridad absoluta contra
                  todos los vectores de ataque. Reporta vulnerabilidades a{" "}
                  <a
                    href="mailto:tequilitros@gmail.com"
                    className="font-semibold text-primary hover:underline"
                  >
                    tequilitros@gmail.com
                  </a>
                  .
                </p>
              </div>
            </div>
          </section>

          {/* 5. Compartir Información */}
          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">
              5. Compartir Información
            </h2>

            <div className="space-y-4">
              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
                <h3 className="font-semibold text-on-surface mb-3">
                  ✅ Información que SÍ compartimos
                </h3>
                <ul className="space-y-2 ml-4 text-on-surface-variant">
                  <li>
                    <strong>Internamente:</strong> Solo con empleados de Destiladora
                    del Norte que necesitan acceso para funciones autorizadas
                  </li>
                  <li>
                    <strong>Proveedores de Servicios:</strong> Neon (base de datos),
                    Vercel (hosting), Resend (email), Anthropic (IA)
                  </li>
                  <li>
                    <strong>Autoridades:</strong> Si lo requiere la ley o una orden
                    judicial
                  </li>
                </ul>
              </div>

              <div className="rounded-lg border border-error/20 bg-error/5 p-5">
                <h3 className="font-semibold text-error mb-3">
                  ❌ Información que NO compartimos
                </h3>
                <ul className="space-y-2 ml-4 text-error/80">
                  <li>
                    ❌ Contraseñas (jamás en texto plano)
                  </li>
                  <li>
                    ❌ Información con publicidades o redes sociales
                  </li>
                  <li>
                    ❌ Datos sensibles con terceros comerciales
                  </li>
                  <li>
                    ❌ Información de empleados sin consentimiento
                  </li>
                </ul>
              </div>

              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
                <h3 className="font-semibold text-on-surface mb-3">
                  🌍 Transferencias Internacionales
                </h3>
                <p className="text-sm text-on-surface-variant">
                  Algunos proveedores (Vercel, Anthropic) pueden procesar datos en
                  servidores fuera de México. Todos implementan protecciones
                  equivalentes a estándares internacionales.
                </p>
              </div>
            </div>
          </section>

          {/* 6. Retención de Datos */}
          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">
              6. Retención de Datos
            </h2>

            <div className="overflow-x-auto rounded-lg border border-outline-variant">
              <table className="w-full text-sm">
                <thead className="bg-surface-container border-b border-outline-variant">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-primary">
                      Tipo de Dato
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-primary">
                      Retención
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  <tr className="hover:bg-surface-container-low">
                    <td className="px-4 py-3 font-medium">Datos de Perfil</td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      Mientras cuenta activa
                    </td>
                  </tr>
                  <tr className="hover:bg-surface-container-low">
                    <td className="px-4 py-3 font-medium">
                      Datos Operacionales
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      7 años (requerimiento fiscal)
                    </td>
                  </tr>
                  <tr className="hover:bg-surface-container-low">
                    <td className="px-4 py-3 font-medium">Logs de Acceso</td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      2 años (auditoría)
                    </td>
                  </tr>
                  <tr className="hover:bg-surface-container-low">
                    <td className="px-4 py-3 font-medium">Backups</td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      30 días (recuperación)
                    </td>
                  </tr>
                  <tr className="hover:bg-surface-container-low">
                    <td className="px-4 py-3 font-medium">
                      Registros de Sesión
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      90 días
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-sm text-on-surface-variant">
              Después de eliminar tu cuenta, tus datos personales se borran en 30
              días, pero retenemos datos operacionales para cumplir obligaciones
              legales.
            </p>
          </section>

          {/* 7. Tus Derechos */}
          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">
              7. Tus Derechos (GDPR & CCPA)
            </h2>

            <div className="space-y-3">
              <div className="flex gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-4">
                <span className="text-lg">👁️</span>
                <div>
                  <p className="font-semibold text-on-surface">Derecho de Acceso</p>
                  <p className="text-sm text-on-surface-variant">
                    Puedes solicitar una copia de tus datos personales
                  </p>
                </div>
              </div>

              <div className="flex gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-4">
                <span className="text-lg">✏️</span>
                <div>
                  <p className="font-semibold text-on-surface">Derecho de Corrección</p>
                  <p className="text-sm text-on-surface-variant">
                    Puedes actualizar información inexacta
                  </p>
                </div>
              </div>

              <div className="flex gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-4">
                <span className="text-lg">🗑️</span>
                <div>
                  <p className="font-semibold text-on-surface">Derecho al Olvido</p>
                  <p className="text-sm text-on-surface-variant">
                    Puedes solicitar la eliminación (excepto datos requeridos por ley)
                  </p>
                </div>
              </div>

              <div className="flex gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-4">
                <span className="text-lg">📦</span>
                <div>
                  <p className="font-semibold text-on-surface">Portabilidad</p>
                  <p className="text-sm text-on-surface-variant">
                    Puedes solicitar tus datos en formato transferible
                  </p>
                </div>
              </div>

              <div className="flex gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-4">
                <span className="text-lg">⛔</span>
                <div>
                  <p className="font-semibold text-on-surface">Derecho de Objeción</p>
                  <p className="text-sm text-on-surface-variant">
                    Puedes oponernte a ciertos tratamientos (si aplica)
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-lg border border-outline-variant bg-surface-container-low p-5">
              <p className="font-semibold text-on-surface mb-2">
                📞 Cómo Ejercer tus Derechos
              </p>
              <p className="text-sm text-on-surface-variant mb-3">
                Envía un email a:
              </p>
              <a
                href="mailto:tequilitros@gmail.com"
                className="inline-block rounded bg-primary px-4 py-2 font-semibold text-on-primary hover:opacity-90 transition"
              >
                tequilitros@gmail.com
              </a>
              <p className="text-xs text-on-surface-variant mt-3">
                Responderemos en máximo 30 días. Se puede solicitar documento de
                identificación para verificación.
              </p>
            </div>
          </section>

          {/* 8. Cookies y Tracking */}
          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">
              8. Cookies y Tracking
            </h2>

            <div className="space-y-4">
              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
                <p className="font-semibold text-on-surface mb-3">
                  🍪 Cookies que Usamos
                </p>
                <ul className="space-y-2 ml-4 text-sm text-on-surface-variant">
                  <li>
                    <strong>maestro_session:</strong> Token de sesión (HttpOnly,
                    Secure)
                  </li>
                  <li>
                    <strong>Cookies de Vercel:</strong> Para load balancing y
                    deployment
                  </li>
                </ul>
              </div>

              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
                <p className="font-semibold text-on-surface mb-3">
                  ❌ Tracking que NO Usamos
                </p>
                <ul className="space-y-2 ml-4 text-sm text-on-surface-variant">
                  <li>❌ Google Analytics (respetamos privacidad)</li>
                  <li>❌ Facebook Pixel o similares</li>
                  <li>❌ Cookies de terceros para publicidad</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 9. Política para Menores */}
          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">
              9. Privacidad de Menores
            </h2>

            <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
              <p className="text-on-surface-variant">
                Maestro está diseñado solo para empleados adultos de Destiladora del
                Norte. No recolectamos información de menores de 18 años
                intencionalmente. Si descubrimos que un menor está usando la
                plataforma, eliminaremos su cuenta inmediatamente.
              </p>
            </div>
          </section>

          {/* 10. Cambios a Esta Política */}
          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">
              10. Cambios a Esta Política
            </h2>

            <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
              <p className="text-on-surface-variant mb-4">
                Podemos actualizar esta política ocasionalmente para reflejar
                cambios legales, tecnológicos o en nuestras prácticas. Las
                actualizaciones importantes se comunicarán por email.
              </p>
              <p className="text-xs text-on-surface-variant">
                Última revisión: 14 de agosto de 2026
              </p>
            </div>
          </section>

          {/* 11. Contacto */}
          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">
              11. Contacto
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
                <p className="font-semibold text-on-surface mb-3">📧 Email</p>
                <a
                  href="mailto:tequilitros@gmail.com"
                  className="text-primary hover:underline font-medium"
                >
                  tequilitros@gmail.com
                </a>
              </div>

              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
                <p className="font-semibold text-on-surface mb-3">🏢 Empresa</p>
                <p className="text-on-surface-variant text-sm">
                  Destiladora del Norte
                  <br />
                  Jalisco, México
                </p>
              </div>

              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
                <p className="font-semibold text-on-surface mb-3">🌐 Plataforma</p>
                <a
                  href="https://maestro-destiladora.space"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium"
                >
                  maestro-destiladora.space
                </a>
              </div>

              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
                <p className="font-semibold text-on-surface mb-3">
                  ⚖️ Autoridades
                </p>
                <p className="text-on-surface-variant text-sm">
                  Si tienes quejas sobre tratamiento de datos, contacta a las
                  autoridades de privacidad locales.
                </p>
              </div>
            </div>
          </section>

          {/* Footer */}
          <section className="border-t border-outline-variant pt-8">
            <div className="rounded-lg bg-surface-container-low p-6 text-center">
              <p className="font-semibold text-on-surface mb-4">
                ¿Preguntas sobre esta política?
              </p>
              <a
                href="mailto:tequilitros@gmail.com?subject=Pregunta%20sobre%20Política%20de%20Privacidad"
                className="inline-block rounded-lg bg-primary px-6 py-3 font-semibold text-on-primary hover:opacity-90 transition"
              >
                Enviar Email
              </a>
            </div>
          </section>
        </div>

        {/* Back Button */}
        <div className="mt-12 flex justify-center">
          <Link
            href="/login"
            className="text-center text-sm font-medium text-primary hover:opacity-80 transition"
          >
            ← Volver al login
          </Link>
        </div>
      </div>
    </main>
  );
}
