import Link from "next/link";

export const metadata = {
  title: "Términos de Servicio - Maestro",
  description:
    "Términos y condiciones de uso de la aplicación Maestro de Destiladora del Norte",
};

export default function TermsOfService() {
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
          <h1 className="text-4xl font-bold text-primary">Términos de Servicio</h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            Última actualización: 14 de agosto de 2026
          </p>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="space-y-8 text-on-surface">
          {/* Intro */}
          <section className="rounded-lg border border-outline-variant bg-surface-container-low p-6">
            <p className="text-lg leading-relaxed font-semibold text-primary">
              ⚖️ Acuerdo Legal Vinculante
            </p>
            <p className="mt-3 leading-relaxed">
              Al acceder y usar <strong>Maestro</strong>, aceptas estar vinculado
              por estos Términos de Servicio. Si no aceptas estos términos, no
              debes usar la plataforma. Maestro es propiedad y operada por{" "}
              <strong>Destiladora del Norte</strong>.
            </p>
          </section>

          {/* 1. Aceptación de Términos */}
          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">
              1. Aceptación de Términos
            </h2>

            <div className="space-y-4">
              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
                <p className="font-semibold text-on-surface mb-3">
                  Consentimiento Informado
                </p>
                <ul className="space-y-2 ml-4 text-on-surface-variant">
                  <li>
                    ✓ Reconoces que has leído y entiendes estos términos
                  </li>
                  <li>
                    ✓ Aceptas estar legalmente vinculado por estos términos
                  </li>
                  <li>
                    ✓ Tu acceso a Maestro constituye aceptación completa
                  </li>
                  <li>
                    ✓ Si no aceptas, debes dejar de usar inmediatamente
                  </li>
                </ul>
              </div>

              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
                <p className="font-semibold text-on-surface mb-3">
                  Cambios a los Términos
                </p>
                <p className="text-on-surface-variant">
                  Nos reservamos el derecho de modificar estos términos en
                  cualquier momento. Los cambios significativos serán notificados
                  por email con 30 días de anticipación. Tu continuo uso después
                  de cambios constituye aceptación.
                </p>
              </div>
            </div>
          </section>

          {/* 2. Elegibilidad */}
          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">
              2. Elegibilidad
            </h2>

            <div className="space-y-4">
              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
                <h3 className="font-semibold text-on-surface mb-3">
                  👤 Quién Puede Usar Maestro
                </h3>
                <ul className="space-y-2 ml-4 text-on-surface-variant">
                  <li>
                    ✓ Empleados activos de Destiladora del Norte
                  </li>
                  <li>
                    ✓ Mayores de 18 años
                  </li>
                  <li>
                    ✓ Con credenciales válidas otorgadas por administrador
                  </li>
                  <li>
                    ✓ Con consentimiento expreso de la empresa
                  </li>
                </ul>
              </div>

              <div className="rounded-lg border border-error/20 bg-error/5 p-5">
                <h3 className="font-semibold text-error mb-3">
                  ❌ Prohibición de Acceso
                </h3>
                <p className="text-error/80 mb-3">
                  No está permitido usar Maestro si:
                </p>
                <ul className="space-y-2 ml-4 text-error/80">
                  <li>• No eres empleado de Destiladora del Norte</li>
                  <li>• Tu relación laboral ha terminado</li>
                  <li>• Has sido dado de baja o suspendido</li>
                  <li>• Eres menor de 18 años</li>
                  <li>• Has sido prohibido por administrador</li>
                  <li>• Usas la plataforma en jurisdicción donde es ilegal</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 3. Acceso y Autenticación */}
          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">
              3. Acceso y Autenticación
            </h2>

            <div className="space-y-4">
              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
                <h3 className="font-semibold text-on-surface mb-3">
                  🔑 Responsabilidades de Contraseña
                </h3>
                <ul className="space-y-2 ml-4 text-on-surface-variant">
                  <li>
                    • Eres responsable de mantener tu contraseña confidencial
                  </li>
                  <li>
                    • No debes compartir credenciales con otros empleados
                  </li>
                  <li>
                    • Debes cambiar contraseña si sospechas compromiso
                  </li>
                  <li>
                    • Notifica inmediatamente acceso no autorizado
                  </li>
                  <li>
                    • No uses contraseña débil o común
                  </li>
                </ul>
              </div>

              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
                <h3 className="font-semibold text-on-surface mb-3">
                  📱 Dispositivos Autenticados
                </h3>
                <p className="text-on-surface-variant">
                  Maestro permite recordar dispositivos por 30 días. Esto es tu
                  responsabilidad. Cierra sesión en dispositivos compartidos.
                </p>
              </div>

              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
                <h3 className="font-semibold text-on-surface mb-3">
                  🔐 Métodos de Autenticación Soportados
                </h3>
                <ul className="space-y-2 ml-4 text-on-surface-variant">
                  <li>• Contraseña + Usuario (recomendado)</li>
                  <li>• Código SMS temporal (2FA)</li>
                  <li>• PIN de 4 dígitos (solo kiosco)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 4. Responsabilidades del Usuario */}
          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">
              4. Responsabilidades del Usuario
            </h2>

            <div className="space-y-4">
              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
                <h3 className="font-semibold text-on-surface mb-3">
                  ✅ Obligaciones
                </h3>
                <ul className="space-y-2 ml-4 text-on-surface-variant">
                  <li>
                    • Usar Maestro únicamente para funciones laborales autorizadas
                  </li>
                  <li>
                    • Cumplir con políticas de Destiladora del Norte
                  </li>
                  <li>
                    • Reportar errores o actividades sospechosas
                  </li>
                  <li>
                    • No intentar acceder a datos sin autorización
                  </li>
                  <li>
                    • Mantener información de cuenta segura
                  </li>
                  <li>
                    • Cumplir con todas las leyes aplicables
                  </li>
                </ul>
              </div>

              <div className="rounded-lg border border-error/20 bg-error/5 p-5">
                <h3 className="font-semibold text-error mb-3">
                  ⛔ Prohibiciones Estrictas
                </h3>
                <p className="text-error/80 mb-3 font-semibold">
                  Está estrictamente prohibido:
                </p>
                <ul className="space-y-2 ml-4 text-error/80">
                  <li>
                    ❌ <strong>Hacking:</strong> Intentar acceder a sistemas sin
                    autorización
                  </li>
                  <li>
                    ❌ <strong>Malware:</strong> Usar software malicioso o
                    exploits
                  </li>
                  <li>
                    ❌ <strong>DDoS:</strong> Ataques para interrumpir servicio
                  </li>
                  <li>
                    ❌ <strong>Inyecciones SQL:</strong> Manipular consultas
                    directas
                  </li>
                  <li>
                    ❌ <strong>XSS/CSRF:</strong> Ataques de script y falsificación
                  </li>
                  <li>
                    ❌ <strong>Scraping:</strong> Extraer datos masivamente
                  </li>
                  <li>
                    ❌ <strong>Reverse Engineering:</strong> Descompilar o
                    modificar
                  </li>
                  <li>
                    ❌ <strong>Compartir Cuenta:</strong> Dar credenciales a otros
                  </li>
                  <li>
                    ❌ <strong>Fraude:</strong> Manipular datos o transacciones
                  </li>
                  <li>
                    ❌ <strong>Daño Deliberado:</strong> Sabotaje o vandalismo
                  </li>
                  <li>
                    ❌ <strong>Clandestinidad:</strong> Ocultar actividad
                    maliciosa
                  </li>
                  <li>
                    ❌ <strong>Acoso:</strong> Intimidar u hostigar compañeros
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* 5. Propiedad Intelectual */}
          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">
              5. Propiedad Intelectual
            </h2>

            <div className="space-y-4">
              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
                <h3 className="font-semibold text-on-surface mb-3">
                  © Derechos de Autor
                </h3>
                <ul className="space-y-2 ml-4 text-on-surface-variant">
                  <li>
                    • Destiladora del Norte es propietaria de todo contenido de
                    Maestro
                  </li>
                  <li>
                    • Incluyendo código, interfaces, datos, documentos
                  </li>
                  <li>
                    • Están protegidos por ley de derechos de autor mexicana
                  </li>
                  <li>
                    • No puedes reproducir, distribuir o modificar sin permiso
                  </li>
                </ul>
              </div>

              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
                <h3 className="font-semibold text-on-surface mb-3">
                  📋 Uso de Datos Operacionales
                </h3>
                <p className="text-on-surface-variant mb-3">
                  Los datos que generas usando Maestro (transacciones, registros,
                  etc.) son propiedad de Destiladora del Norte. No puedes:
                </p>
                <ul className="space-y-2 ml-4 text-on-surface-variant">
                  <li>• Exportar masivamente para uso personal</li>
                  <li>• Compartir con competidores o terceros</li>
                  <li>• Usar para crear producto competidor</li>
                  <li>• Publicar públicamente sin autorización</li>
                </ul>
              </div>

              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
                <h3 className="font-semibold text-on-surface mb-3">
                  🎁 Licencia de Uso
                </h3>
                <p className="text-on-surface-variant">
                  Se te otorga una licencia limitada, no transferible, no
                  exclusiva para usar Maestro únicamente para funciones laborales
                  autorizadas. La licencia termina cuando tu empleo termina.
                </p>
              </div>
            </div>
          </section>

          {/* 6. Limitación de Responsabilidad */}
          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">
              6. Limitación de Responsabilidad
            </h2>

            <div className="space-y-4">
              <div className="rounded-lg border border-error/20 bg-error/5 p-5">
                <h3 className="font-semibold text-error mb-3">
                  ⚠️ Descargo de Garantías
                </h3>
                <p className="text-error/80 font-semibold mb-3">
                  MAESTRO SE PROPORCIONA "TAL CUAL" SIN GARANTÍAS DE NINGÚN TIPO.
                </p>
                <ul className="space-y-2 ml-4 text-error/80">
                  <li>
                    🔴 No garantizamos disponibilidad 24/7
                  </li>
                  <li>
                    🔴 No garantizamos ausencia de errores
                  </li>
                  <li>
                    🔴 No garantizamos seguridad absoluta
                  </li>
                  <li>
                    🔴 No garantizamos recuperación de datos perdidos
                  </li>
                  <li>
                    🔴 No garantizamos desempeño específico
                  </li>
                </ul>
              </div>

              <div className="rounded-lg border border-error/20 bg-error/5 p-5">
                <h3 className="font-semibold text-error mb-3">
                  🚫 No Responsabilidad por
                </h3>
                <p className="text-error/80 mb-3">
                  Destiladora del Norte NO es responsable por:
                </p>
                <ul className="space-y-2 ml-4 text-error/80">
                  <li>
                    • Pérdida de datos por cualquier razón
                  </li>
                  <li>
                    • Interrupciones del servicio o downtime
                  </li>
                  <li>
                    • Daños indirectos, incidentales o consecuentes
                  </li>
                  <li>
                    • Pérdida de ganancias o ingresos
                  </li>
                  <li>
                    • Daño reputacional
                  </li>
                  <li>
                    • Errores de usuario o mal uso
                  </li>
                  <li>
                    • Acceso no autorizado debido a tu negligencia
                  </li>
                  <li>
                    • Ataques cibernéticos más allá de control razonable
                  </li>
                </ul>
              </div>

              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
                <h3 className="font-semibold text-on-surface mb-3">
                  📊 Límites de Responsabilidad
                </h3>
                <p className="text-on-surface-variant">
                  En ningún caso la responsabilidad total de Destiladora del
                  Norte excederá USD $100 o el equivalente en pesos mexicanos. En
                  caso de fraude confirmado, se pueden aplicar daños punitivos.
                </p>
              </div>
            </div>
          </section>

          {/* 7. Suspensión de Acceso */}
          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">
              7. Suspensión de Acceso
            </h2>

            <div className="space-y-4">
              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
                <h3 className="font-semibold text-on-surface mb-3">
                  🔒 Causas Automáticas
                </h3>
                <p className="text-on-surface-variant mb-3">
                  Tu acceso será suspendido inmediatamente si:
                </p>
                <ul className="space-y-2 ml-4 text-on-surface-variant">
                  <li>• Tu relación laboral termina (renuncia, despido)</li>
                  <li>• Incumples prohibiciones de seguridad</li>
                  <li>• Realizas ataques o intentos de hacking</li>
                  <li>• Compartes credenciales deliberadamente</li>
                  <li>• Fraude confirmado o malversación</li>
                </ul>
              </div>

              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
                <h3 className="font-semibold text-on-surface mb-3">
                  ⏸️ Causas Administrativas
                </h3>
                <p className="text-on-surface-variant mb-3">
                  Destiladora del Norte puede suspender sin previo aviso:
                </p>
                <ul className="space-y-2 ml-4 text-on-surface-variant">
                  <li>• Mantenimiento de seguridad</li>
                  <li>• Investigación de actividad sospechosa</li>
                  <li>• Protección de datos de otros usuarios</li>
                  <li>• Cumplimiento legal o regulatorio</li>
                </ul>
              </div>

              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
                <h3 className="font-semibold text-on-surface mb-3">
                  🔄 Procedimiento de Suspensión
                </h3>
                <ol className="space-y-2 ml-4 text-on-surface-variant">
                  <li>1. Primera violación: Advertencia por email</li>
                  <li>2. Segunda violación: Suspensión temporal (7 días)</li>
                  <li>3. Tercera violación: Suspensión permanente</li>
                  <li>4. Fraude: Suspensión inmediata + reporte legal</li>
                </ol>
              </div>

              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
                <h3 className="font-semibold text-on-surface mb-3">
                  📋 Apelación
                </h3>
                <p className="text-on-surface-variant">
                  Puedes apelar una suspensión enviando evidencia a{" "}
                  <a
                    href="mailto:tequilitros@gmail.com"
                    className="font-semibold text-primary hover:underline"
                  >
                    tequilitros@gmail.com
                  </a>{" "}
                  dentro de 10 días. Revisaremos y responderemos en máximo 15
                  días.
                </p>
              </div>
            </div>
          </section>

          {/* 8. Indemnización */}
          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">
              8. Indemnización
            </h2>

            <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
              <p className="text-on-surface-variant">
                Aceptas indemnizar y defender a Destiladora del Norte contra
                cualquier reclamo, daño, pérdida, responsabilidad o gasto
                (incluyendo honorarios legales) que resulte de:
              </p>
              <ul className="space-y-2 ml-4 text-on-surface-variant mt-3">
                <li>
                  • Violación de estos términos
                </li>
                <li>
                  • Violación de leyes o regulaciones
                </li>
                <li>
                  • Infracción de derechos de terceros
                </li>
                <li>
                  • Tu uso negligente o intencional de Maestro
                </li>
                <li>
                  • Fraude o deshonestidad
                </li>
              </ul>
            </div>
          </section>

          {/* 9. Ley Aplicable */}
          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">
              9. Ley Aplicable y Jurisdicción
            </h2>

            <div className="space-y-4">
              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
                <h3 className="font-semibold text-on-surface mb-3">
                  ⚖️ Jurisdicción
                </h3>
                <ul className="space-y-2 ml-4 text-on-surface-variant">
                  <li>
                    • Estos términos se rigen por leyes de Jalisco, México
                  </li>
                  <li>
                    • Exclusivamente sujeto a cortes en Guadalajara, Jalisco
                  </li>
                  <li>
                    • Renuencias a jurisdicción se consideran aceptadas
                  </li>
                  <li>
                    • Ambas partes renuncian a jury trial
                  </li>
                </ul>
              </div>

              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
                <h3 className="font-semibold text-on-surface mb-3">
                  🤝 Resolución de Disputas
                </h3>
                <p className="text-on-surface-variant mb-3">
                  Antes de cualquier acción legal:
                </p>
                <ol className="space-y-2 ml-4 text-on-surface-variant">
                  <li>
                    1. Notifica por escrito a{" "}
                    <a
                      href="mailto:tequilitros@gmail.com"
                      className="text-primary hover:underline font-semibold"
                    >
                      tequilitros@gmail.com
                    </a>
                  </li>
                  <li>2. Espera 30 días para respuesta</li>
                  <li>3. Intenta resolución amistosa</li>
                  <li>4. Si falla, procede con acción legal</li>
                </ol>
              </div>
            </div>
          </section>

          {/* 10. Severabilidad */}
          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">
              10. Severabilidad
            </h2>

            <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
              <p className="text-on-surface-variant">
                Si alguna parte de estos términos se considera inválida o no
                exigible, esa parte será removida pero el resto permanecerá en
                vigor. Intentaremos reemplazar la parte inválida con una
                válida que sea tan cercana al intento original como sea posible.
              </p>
            </div>
          </section>

          {/* 11. Acuerdo Completo */}
          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">
              11. Acuerdo Completo
            </h2>

            <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
              <p className="text-on-surface-variant">
                Estos Términos de Servicio, junto con la Política de Privacidad,
                constituyen el acuerdo completo entre tú y Destiladora del
                Norte. Prevalecen sobre cualquier acuerdo anterior, comunicación
                oral o escrita. No hay garantías orales o implícitas más allá de
                lo establecido aquí.
              </p>
            </div>
          </section>

          {/* 12. Contacto */}
          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">
              12. Contacto
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
                <p className="font-semibold text-on-surface mb-3">📧 Correos</p>
                <a
                  href="mailto:tequilitros@gmail.com"
                  className="text-primary hover:underline font-medium block mb-2"
                >
                  tequilitros@gmail.com
                </a>
                <p className="text-xs text-on-surface-variant">
                  Para cualquier pregunta o disputa
                </p>
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
                <p className="font-semibold text-on-surface mb-3">🌐 Sitio</p>
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
                <p className="font-semibold text-on-surface mb-3">📋 Políticas</p>
                <a
                  href="/privacy-policy"
                  className="text-primary hover:underline font-medium block mb-2"
                >
                  Política de Privacidad
                </a>
                <p className="text-xs text-on-surface-variant mt-1">
                  Ver nuestras prácticas de privacidad
                </p>
              </div>
            </div>
          </section>

          {/* Footer Section */}
          <section className="border-t border-outline-variant pt-8">
            <div className="rounded-lg bg-surface-container-low p-6 text-center">
              <p className="font-semibold text-on-surface mb-4">
                Reconocimiento de Aceptación
              </p>
              <p className="text-sm text-on-surface-variant mb-4">
                Al usar Maestro, reconoces que has leído, entendido y aceptas estar
                vinculado por estos Términos de Servicio.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/login"
                  className="inline-block rounded-lg bg-primary px-6 py-3 font-semibold text-on-primary hover:opacity-90 transition"
                >
                  Aceptar y Continuar
                </Link>
                <Link
                  href="/privacy-policy"
                  className="inline-block rounded-lg border border-outline-variant px-6 py-3 font-semibold text-primary hover:bg-surface-container-low transition"
                >
                  Política de Privacidad
                </Link>
              </div>
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
