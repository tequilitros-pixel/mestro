# 🔐 Script Interactivo de Rotación de Credenciales

Este script te guía paso a paso para revocar todas las credenciales expuestas.

## ⚡ Quick Start

```bash
# Instalar dependencias (si es necesario)
npm install

# Ejecutar el script
node scripts/rotate-credentials.js
```

## 📋 Qué Hace el Script

### 1. Te Guía Paso a Paso
Para cada servicio:
- ✓ Te muestra la URL
- ✓ Te da instrucciones detalladas
- ✓ Espera a que copies la credencial nueva
- ✓ La guarda en .env

### 2. Genera Automáticamente
Para CRON Secret:
- ✓ Genera una contraseña fuerte automáticamente
- ✓ La guarda en .env

### 3. Prepara Vercel
- ✓ Te muestra cómo actualizar Vercel CLI
- ✓ Genera archivo de comandos
- ✓ Te guía a dashboard si prefieres

### 4. Valida
- ✓ Verifica que valores tienen longitud correcta
- ✓ Te permite reintentar si algo falla

## 🎯 Servicios Cubiertos

| Servicio | URL | Variable |
|----------|-----|----------|
| Neon (Database) | https://console.neon.tech | DATABASE_URL |
| Anthropic | https://console.anthropic.com/account/keys | ANTHROPIC_API_KEY |
| Resend | https://resend.com/api-keys | RESEND_API_KEY |
| VAPID Public | https://www.vapidkeys.com/ | NEXT_PUBLIC_VAPID_PUBLIC_KEY |
| VAPID Private | https://www.vapidkeys.com/ | VAPID_PRIVATE_KEY |
| Vercel Blob | https://vercel.com/account/storage | BLOB_READ_WRITE_TOKEN |
| CRON Secret | (Auto) | CRON_SECRET |

## 📝 Qué Necesitas

### Antes de Ejecutar
- [ ] Acceso a todas tus cuentas
- [ ] Terminal/Command Prompt abierta
- [ ] Conexión internet
- [ ] Node.js instalado (v14+)

### Durante la Ejecución
- [ ] Tenga abiertas las URLs de cada servicio
- [ ] Copie/pegue credenciales cuando se solicite
- [ ] Confirme que está listo para cada paso

### Después
- [ ] Actualizar Vercel (CLI o Dashboard)
- [ ] Esperar redeploy (~60 segundos)
- [ ] Probar que app funciona
- [ ] Eliminar archivo temporal de credenciales

## 🚀 Uso Detallado

### Paso 1: Ejecutar el Script
```bash
node scripts/rotate-credentials.js
```

### Paso 2: Seguir Instrucciones
El script te mostrará para cada servicio:
```
PASO: Base de Datos (Neon)
─────────────────────────
URL: https://console.neon.tech
Variable: DATABASE_URL

1. Ir a https://console.neon.tech
2. Login con tu cuenta
3. Ir a Settings → Roles
... [más pasos]

Pega el valor aquí
> [espera tu input]
```

### Paso 3: Copiar Credenciales
- Abre la URL en tu navegador
- Sigue los pasos
- Copia la credencial nueva
- Pega en el script

### Paso 4: Actualizar Vercel
El script te da opciones:

**Opción A: Dashboard Web**
```
1. https://vercel.com → maestro → Settings
2. Environment Variables
3. Edita cada variable
4. Pega el valor nuevo
5. Save
```

**Opción B: CLI**
```bash
# El script genera estos comandos:
vercel env add DATABASE_URL
vercel env add ANTHROPIC_API_KEY
# etc...
```

### Paso 5: Probar Localmente
```bash
npm run dev
# Abre http://localhost:3000
# Intenta login - debe funcionar
```

### Paso 6: Probar en Producción
```
Espera 30-60 segundos para Vercel
Abre https://maestro-destiladora.space
Intenta login - debe funcionar
```

## 📁 Archivos Que El Script Crea

### 1. `.env` (Actualizado)
Archivo local con todas las credenciales nuevas.
```
DATABASE_URL=postgresql://neondb_owner:npg_...
ANTHROPIC_API_KEY=sk-ant-api03-...
RESEND_API_KEY=re_...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
CRON_SECRET=...
```

### 2. `scripts/update-vercel-env.sh` (Generado)
Script opcional para actualizar Vercel via CLI.
```bash
#!/bin/bash
vercel env add DATABASE_URL
# Pega: postgresql://...
...
```

### 3. `scripts/.credentials-temp.txt` (Temporal)
Archivo temporal con todas las credenciales.
```
⚠️  ARCHIVO TEMPORAL - ELIMINAR DESPUÉS DE USAR

DATABASE_URL=...
ANTHROPIC_API_KEY=...
[etc]
```

**⚠️ IMPORTANTE:** Elimina este archivo después de actualizar Vercel.

## ⏱️ Tiempo Estimado

```
Neon:                5-10 minutos
Anthropic:           2-3 minutos
Resend:              2-3 minutos
VAPID:               3-5 minutos
Vercel Blob:         3-5 minutos
CRON (auto):         < 1 minuto
─────────────────────────────────
Ejecutar script:     15-20 minutos

Actualizar Vercel:   5 minutos
Testing:             10 minutos
─────────────────────────────────
TOTAL:               45-60 minutos
```

## ✅ Checklist Final

Después de completar:

```
[ ] Ejecuté node scripts/rotate-credentials.js
[ ] Copié todas las credenciales nuevas
[ ] El script las guardó en .env
[ ] Actualicé Vercel (CLI o Dashboard)
[ ] Esperé 30-60 segundos para redeploy
[ ] Ejecuté npm run dev
[ ] Probé login en http://localhost:3000
[ ] Probé login en https://maestro-destiladora.space
[ ] Todo funciona correctamente
[ ] Eliminé .credentials-temp.txt
[ ] Verifiqué que .env está en .gitignore
```

## 🐛 Troubleshooting

### Error: "Valor muy corto"
- Asegúrate de copiar la credencial COMPLETA
- Verifica que no faltan caracteres
- Intenta de nuevo

### "Database connection failed"
- Verifica que actualizaste DATABASE_URL en Vercel
- Espera 60 segundos más para redeploy
- Revisa logs en Vercel

### "Invalid API key"
- Verifica que la key está completa
- No debe tener espacios al inicio/final
- Intenta copiar de nuevo del servicio original

### "Script no se ejecuta"
Asegúrate de tener Node.js:
```bash
node --version  # Debe ser v14+
```

Si no está instalado:
```bash
# macOS/Linux:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Windows:
# Descargar desde https://nodejs.org/
```

## 🔒 Seguridad

### Lo que el script HACE:
- ✓ Lee input del usuario
- ✓ Guarda en archivo local .env
- ✓ Te muestra comandos para Vercel
- ✓ Genera contraseña fuerte local

### Lo que el script NO hace:
- ✗ NO accede a tus cuentas (no es posible)
- ✗ NO envía credenciales a internet
- ✗ NO almacena credenciales en la nube
- ✗ NO comparte datos con terceros

### Después de Ejecutar:
1. El archivo `.credentials-temp.txt` contiene todos los valores
2. **DEBES ELIMINARLO** después de actualizar Vercel
3. El `.env` es local - no lo commits a Git
4. Verifica que `.gitignore` contiene `.env`

## 📞 Soporte

Si algo no funciona:

1. Revisa este README
2. Revisa las instrucciones del paso específico
3. Abre un issue con:
   - Paso donde falló
   - Mensaje de error
   - Sistema operativo

## 🎯 Próximos Pasos

Después de completar las credenciales:

1. [ ] Revocar credenciales (este script)
2. [ ] Actualizar .gitignore
3. [ ] Crear metadata para App Store
4. [ ] Tomar screenshots
5. [ ] Build iOS
6. [ ] Enviar a App Store

---

**¿Necesitas ayuda?** Lee la guía completa en `REVOCAR_CREDENCIALES.md`
