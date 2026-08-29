# Secure Key Manager — PWA

Aplicación web progresiva (PWA) **100% cliente-side** para gestionar API keys de forma segura.
El vault se cifra con AES-256-GCM (PBKDF2-SHA256) directamente en el navegador y se sincroniza
con un repositorio de GitHub mediante la REST Contents API.

No necesita backend, servidor ni compilación. Funciona como archivos estáticos en GitHub Pages.

## Estado actual

🚀 **Desplegada y funcionando.** URL pública:

```
https://asistentepaul-ai.github.io/API-key-manager/
```

- Repo (público): `asistentepaul-ai/API-key-manager`
- Rama: `main` · Carpeta: `/ (root)` · GitHub Pages activo
- Iconos PNG reales y Service Worker (network-first para el shell) listos para instalar en Android.

## Formato del vault

Compatible con el backend Python existente (`backend/crypto.py`). El vault cifrado (`vault.enc`)
tiene este formato:

```json
{
  "salt": "base64",
  "nonce": "base64",
  "ciphertext": "base64"
}
```

- PBKDF2-SHA256 con 600000 iteraciones, clave de 32 bytes (256 bits), salt de 16 bytes
- AES-256-GCM con nonce de 12 bytes, tag de 16 bytes añadido al final del ciphertext, sin AAD
- El texto plano es un JSON: `{"keys": [{"id": "...", "name": "...", "value": "...", "notes": "...", "created_at": "...", "updated_at": "..."}]}`

## Usar desde el móvil (Android)

1. Abre en Chrome de Android: `https://asistentepaul-ai.github.io/API-key-manager/`
2. Toca el menú (⋮) → **"Instalar aplicación"** (o "Añadir a pantalla de inicio").
   - Si el menú no ofrece instalar, **cierra y reabre la app** una o dos veces (el Service Worker
     se actualiza en segundo plano) y **borra los datos del sitio** (⋮ → Ajustes del sitio →
     borrar datos) para forzar la versión nueva.
3. La primera vez, ve a **Sincronizar** y configura:
   - Owner: `asistentepaul-ai`
   - Repositorio: `API-key-manager`
   - Ruta: `vault.enc`
   - Rama: `main`
   - Token: tu **fine-grained PAT** con permiso Contents **Read and write** sobre ese repo
4. Pulsa "Guardar configuración" y luego "Descargar vault desde GitHub" (o "Subir vault a GitHub").

> ⚠️ **Repo público** = la **lectura** del vault no necesita token (60 requests/hora anónimas).
> **Escribir** (crear/editar keys) **siempre** requiere el token. Para *ver y copiar* tus keys ya
> guardadas, basta con la contraseña maestra.
> Si usas repo privado, el token hace falta también para leer.

## Problemas al desbloquear

Si el móvil muestra "Contraseña incorrecta o vault corrupto": pulsa en pantalla de desbloqueo
**"¿Problemas para desbloquear? Reiniciar datos de este navegador"** (borra el vault local y la
configuración del *navegador*, **nunca** toca GitHub), recarga y vuelve a poner la contraseña
maestra real. El desbloqueo intenta auto-descargar el vault de GitHub si el local falla.

## Configuración para desarrollo / re-despliegue

Normalmente no hace falta: la app ya está publicada. Si quieres replicarla en otro repo:

### 1. Crear un repositorio en GitHub

Publico o privado (ver nota de seguridad en el README raíz).

### 2. Crear un Personal Access Token (fine-grained)

1. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → "Generate new token"
2. Nombre (ej: `secure-key-manager`), Repository access: "Only select repositories" → el repo
3. Permissions → Contents: **Read and write**
4. Generate token y **cópialo inmediatamente** (no se vuelve a mostrar)

### 3. Subir la PWA (una sola vez)

```bash
cd pwa
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git push -u origin main
```

### 4. Activar GitHub Pages

Repo → Settings → Pages → Source: **Deploy from a branch** → branch `main`, folder `/ (root)` → Save.
La PWA queda en `https://TU-USUARIO.github.io/TU-REPO/`.

### 5. Sincronización del vault desde la app

En "Sincronizar": **Owner**, **Repo**, **Ruta** (`vault.enc`), **Rama** (`main`) y **Token**.
"Subir vault a GitHub" hace push del vault cifrado; "Descargar vault desde GitHub" hace pull.

El token y la configuración se guardan en `localStorage`. La contraseña maestra **nunca** se persiste.

## Nota sobre repos públicos

Si usas un repositorio **público**, la lectura del vault no necesita token; la escritura siempre sí.
El vault está cifrado, pero cualquiera puede descargarlo e intentar ataques offline contra la
contraseña maestra. **Usa una contraseña maestra fuerte** (frase de 4+ palabras al azar).

## Compatibilidad

El formato del vault es compatible con el backend Python en `backend/crypto.py`.
Puedes compartir el mismo `vault.enc` entre la PWA (Android/Web) y el backend (Mac/Linux).