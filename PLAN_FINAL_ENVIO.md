# 🚀 PLAN FINAL DE ENVÍO A APP STORE

## Resumen de Estado

### ✅ Completado Por Claude
1. Auditoría de seguridad
2. Política de Privacidad (página web)
3. Términos de Servicio (página web)
4. Página de Soporte
5. Script de rotación de credenciales
6. Metadata App Store (documento)
7. Plan de envío

### ⏳ Pendiente - Requiere Acceso Manual

| Tarea | Responsable | Tiempo |
|-------|------------|--------|
| Ejecutar script de credenciales | Tú | 45-60 min |
| Tomar screenshots | Tú | 20-30 min |
| Build iOS en Xcode | Tú | 30-45 min |
| Llenar AppStoreConnect | Tú | 20-30 min |
| Enviar para revisión | Tú | 5 min |

---

## 📊 ROADMAP FINAL

### SEMANA 1: Preparación de Seguridad

#### Día 1-2: Revocar Credenciales (45-60 min)
```bash
node scripts/rotate-credentials.js
# Sigue instrucciones del script
# Actualiza Vercel
# Prueba que todo funciona
```

**Checklist:**
- [ ] Ejecuté el script
- [ ] Copié todas las credenciales nuevas
- [ ] Actualicé Vercel
- [ ] Testeé localmente
- [ ] Testeé en producción
- [ ] Verifiqué .gitignore

**Estado después:** App segura, credenciales revocadas ✓

---

#### Día 3: Preparar Metadata (Ya Hecho)
```
✓ APP_STORE_METADATA.md contiene todo
✓ Solo copia y pega en AppStoreConnect
```

**Estado después:** Metadata lista para copiar ✓

---

### SEMANA 2: Compilación y Envío

#### Día 4-5: Tomar Screenshots (20-30 min)

**Qué necesitas:**
- iPhone físico O Simulator de Xcode
- App corriendo (npm run dev o build Capacitor)
- Herramienta para tomar screenshots

**Pasos:**
```
1. npm run dev
2. Abre http://localhost:3000 en iPhone
3. Login con usuario de prueba
4. Toma 5 screenshots de:
   - Login screen
   - Dashboard
   - Production page
   - Inventory/POS
   - Reports/Analytics
5. Guarda en carpeta: screenshots/
```

**Requisitos de screenshot:**
- Resolución: 1080x1920 (portrait)
- Sin bordes de dispositivo
- Pantalla completa visible
- Texto legible

**Alternativamente:**
```
Puedes usar mockups genéricos de la app
O pedir a diseñador que cree screenshots
```

**Estado después:** 5 screenshots listos ✓

---

#### Día 6-7: Build iOS (30-45 min)

**Requisitos:**
- Xcode instalado
- Apple Developer account
- Certificados de code signing válidos
- Provisioning profile actual

**Pasos:**
```bash
# 1. Build Next.js
npm run build

# 2. Sync a Capacitor
npx cap sync ios
npx cap update ios

# 3. Instalar dependencias
cd ios
pod install
cd ..

# 4. Abrir en Xcode
open ios/Maestro.xcworkspace

# En Xcode:
# 5. Selecciona: Product → Scheme → Maestro
# 6. Generic iOS Device (para Archive)
# 7. Product → Archive
# 8. Espera a que compile
# 9. Distribuir a App Store Connect
```

**Si hay errores:**
- Revisa logs en Xcode
- Verifica certificados: https://developer.apple.com/account
- Verifica Provisioning Profiles
- Revisa App Store Connect para requisitos actuales

**Estado después:** Build #1 subido a App Store Connect ✓

---

### SEMANA 3: Envío y Revisión

#### Día 8: Llenar AppStoreConnect (20-30 min)

```
1. Ir a: https://appstoreconnect.apple.com
2. Login
3. My Apps → Create New App
4. Llenar información:
   - App Name: Maestro
   - Bundle ID: com.destiladoradelnorte
   - SKU: maestro-2026
5. Ir a: Información
6. Copiar exactamente del documento:
   - Descripción
   - Keywords
   - URLs (Soporte, Privacidad, Términos)
7. Ir a: Imágenes e Vídeos
8. Subir 5 screenshots (JPG o PNG)
9. Ir a: Compilación
10. Seleccionar Build #1
11. Llenar datos de prueba (si es privada)
12. Enviar para revisión
```

**Verificaciones finales:**
- [ ] Toda información es correcta
- [ ] Screenshots son de buena calidad
- [ ] Build está listo
- [ ] Privacidad URL funciona
- [ ] Términos URL funciona
- [ ] Support URL funciona

**Estado después:** App en revisión ✓

---

#### Día 9-14: Revisar Feedback de Apple

```
Apple tarda 24-48 horas típicamente

Posibles resultados:
1. ✓ Aprobado → App aparece en App Store
2. ⚠️ Necesita cambios → Haces ajustes y resubmites
3. ✗ Rechazado → Lees feedback y corriges
```

**Si es rechazado:**
- Lee el feedback cuidadosamente
- Revisa qué violó las guidelines
- Haz los cambios necesarios
- Resubmite

**Causas comunes de rechazo:**
- Metadata no coincide con functionality
- Privacidad o seguridad incompleta
- Screenshot engañoso
- Bugs en la app
- Permisos no justificados

---

## 📋 CHECKLIST COMPLETO

### ANTES DE EMPEZAR
- [ ] Node.js instalado
- [ ] Xcode instalado (en Mac)
- [ ] Apple Developer account activa
- [ ] Acceso a todos los servicios (Neon, Vercel, etc)

### FASE 1: SEGURIDAD (45-60 min)
- [ ] Ejecuté node scripts/rotate-credentials.js
- [ ] Copié todas las credenciales nuevas
- [ ] Actualicé DATABASE_URL en Vercel
- [ ] Actualicé ANTHROPIC_API_KEY en Vercel
- [ ] Actualicé RESEND_API_KEY en Vercel
- [ ] Actualicé VAPID keys en Vercel
- [ ] Actualicé BLOB_READ_WRITE_TOKEN en Vercel
- [ ] Actualicé CRON_SECRET en Vercel
- [ ] Esperé 60 segundos para redeploy
- [ ] Testeé npm run dev - funciona ✓
- [ ] Testeé https://maestro-destiladora.space - funciona ✓
- [ ] Verifiqué .env en .gitignore
- [ ] Eliminé .credentials-temp.txt

### FASE 2: METADATA (Ya hecho)
- [ ] Leí APP_STORE_METADATA.md
- [ ] Copié descripción
- [ ] Copié keywords
- [ ] Copié URLs (soporte, privacidad, términos)
- [ ] Verifiqué todas las URLs funcionan

### FASE 3: SCREENSHOTS (20-30 min)
- [ ] Abrí app en iPhone/Simulator
- [ ] Screenshot 1: Login ✓
- [ ] Screenshot 2: Dashboard ✓
- [ ] Screenshot 3: Production ✓
- [ ] Screenshot 4: Inventory/POS ✓
- [ ] Screenshot 5: Analytics ✓
- [ ] Todos son 1080x1920 (portrait)
- [ ] Guardé en carpeta screenshots/

### FASE 4: BUILD (30-45 min)
- [ ] npm run build ✓
- [ ] npx cap sync ios ✓
- [ ] cd ios && pod install ✓
- [ ] Abrí ios/Maestro.xcworkspace en Xcode
- [ ] Seleccioné Generic iOS Device
- [ ] Product → Archive
- [ ] Espera a que compile
- [ ] Distribuir a App Store Connect
- [ ] Build #1 aparece en AppStoreConnect

### FASE 5: APPSTORECONNECT (20-30 min)
- [ ] Creé nueva app iOS
- [ ] Nombre: Maestro ✓
- [ ] Bundle ID: com.destiladoradelnorte ✓
- [ ] SKU: maestro-2026 ✓
- [ ] Categoría: Business/Productivity ✓
- [ ] Age Rating: 4+ ✓
- [ ] Descripción (copiada exactamente) ✓
- [ ] Keywords (copiadas exactamente) ✓
- [ ] Support URL actualizada ✓
- [ ] Privacy Policy URL actualizada ✓
- [ ] Terms of Service URL agregada ✓
- [ ] Screenshots 1-5 subidas ✓
- [ ] Build #1 seleccionado ✓
- [ ] Testeador demo configurado (si es privada) ✓

### FASE 6: ENVÍO
- [ ] Verifiqué toda información es correcta
- [ ] Verifiqué screenshots son de calidad
- [ ] Verifiqué URLs funcionan
- [ ] Verifiqué build está listo
- [ ] Click "Enviar para Revisión"
- [ ] Acepté términos de Apple
- [ ] Confirmé envío

### FASE 7: REVISIÓN
- [ ] Esperé respuesta de Apple (24-48h)
- [ ] Si aprobado: Aparece en App Store ✓
- [ ] Si rechazado: Leí feedback, hice cambios, resubmitir
- [ ] Monitoreé estado en AppStoreConnect

---

## ⏱️ TIMELINE TOTAL

```
Revocar credenciales:     45-60 min
Tomar screenshots:        20-30 min
Build iOS:                30-45 min
Llenar AppStoreConnect:   20-30 min
Envío:                    5 min
─────────────────────────────────
TOTAL TIEMPO ACTIVO:      2-3 horas
Revisión de Apple:        24-48 horas (automática)

TOTAL CALENDARIO:         3-4 días
```

---

## 🎯 QPLÁCILMENTE FÁCIL DE HACER

### SÍ PUEDO HACER (Claude):
- ✅ Auditoría de seguridad
- ✅ Documentación completa
- ✅ Código de páginas web
- ✅ Script interactivo
- ✅ Guías paso a paso
- ✅ Metadata document
- ✅ Checklists

### NO PUEDO HACER (Requiere Acceso Manual):
- ❌ Acceder a cuentas (Neon, Vercel, etc) - requiere 2FA
- ❌ Tomar screenshots de app - requiere dispositivo
- ❌ Compilar en Xcode - requiere Mac + certificados
- ❌ Llenar formularios web en AppStoreConnect - requiere login
- ❌ Enviar para revisión - requiere autorización

---

## 📞 PREGUNTAS FRECUENTES

### ¿Cuánto tarda la revisión de Apple?
**24-48 horas típicamente.** A veces más si hay preguntas.

### ¿Qué pasa si es rechazada?
Lee el feedback de Apple, haz cambios, resubmite.
Puede ser rechazada 1-2 veces antes de aprobar (normal).

### ¿Es app pública o privada?
**Privada** - Solo para empleados de Destiladora del Norte.
Considera TestFlight para distribución.

### ¿Dónde aparece después de aprobar?
En App Store bajo: Categoría Business
URL: https://apps.apple.com/app/maestro-id-aqui

### ¿Qué pasa si necesito hacer cambios?
Haz cambios en código, crea nuevo build, resubmite en AppStoreConnect.

### ¿Puedo rechazar el envío?
Sí, puedes cancelar en cualquier momento en AppStoreConnect.

---

## 🚀 PRÓXIMOS PASOS INMEDIATOS

### AHORA (Hoy):
1. ✅ Leíste este documento
2. ✅ Leíste APP_STORE_METADATA.md
3. ⏳ Planifica cuándo ejecutarás el script

### MAÑANA:
1. Ejecuta: `node scripts/rotate-credentials.js`
2. Actualiza Vercel
3. Prueba localmente

### PRÓXIMA SEMANA:
1. Toma screenshots
2. Haz build en Xcode
3. Llena AppStoreConnect
4. Envía para revisión

### PRÓXIMAS 2 SEMANAS:
1. Espera respuesta de Apple
2. Haz cambios si es necesario
3. Resubmite si es rechazada
4. App en App Store (si aprobada)

---

## ✅ ESTADO FINAL

```
Auditoría:               ✅ COMPLETADA
Seguridad:              ⏳ PENDIENTE (script)
Documentación Legal:    ✅ COMPLETADA
Metadata:               ✅ COMPLETADA
Build:                  ⏳ PENDIENTE (Xcode)
AppStoreConnect:        ⏳ PENDIENTE (manual)
Envío:                  ⏳ PENDIENTE (manual)
Revisión:               ⏳ PENDIENTE (Apple)
```

---

## 🎉 CONCLUSIÓN

Has completado:
- ✅ Auditoría de seguridad completa
- ✅ Política de privacidad profesional
- ✅ Términos de servicio legales
- ✅ Página de soporte funcional
- ✅ Script de rotación de credenciales
- ✅ Metadata App Store lista

Pendiente:
- ⏳ Ejecutar script (45-60 min)
- ⏳ Tomar screenshots (20-30 min)
- ⏳ Build iOS (30-45 min)
- ⏳ Llenar AppStoreConnect (20-30 min)

**Total tiempo pendiente: 2-3 horas**

**Tu app estará en App Store en menos de 1 semana.**

---

Documento creado: 14 de agosto de 2026
Versión: 1.0.0
Próxima revisión: Cuando hagas cambios importantes
