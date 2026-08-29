# Secure Key Manager — PWA

Aplicación web progresiva (PWA) 100% cliente-side para gestionar API keys de forma segura.
El vault se cifra con AES-256-GCM (PBKDF2-SHA256) directamente en el navegador y se sincroniza
con un repositorio de GitHub mediante la REST Contents API.

No necesita backend, servidor ni compilación. Funciona como archivos estáticos en GitHub Pages.

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

## Setup para GitHub Pages

### 1. Crear un repositorio privado en GitHub

Crea un repositorio **PRIVATE** en GitHub (por ejemplo, `mi-vault`).
No añadas README, .gitignore ni licencia — debe estar vacío.

### 2. Crear un Personal Access Token (fine-grained)

1. Ve a GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. Haz clic en "Generate new token"
3. Dale un nombre (ej: "secure-key-manager")
4. Repository access: "Only select repositories" → selecciona el repo que creaste
5. Permissions → Contents: **Read and write**
6. Generate token y **cópialo inmediatamente** (no se vuelve a mostrar)

### 3. Configurar git y subir la PWA

```bash
# Desde la carpeta pwa/ (ya inicializado con git init y commit inicial)
git remote add origin https://github.com/TU-USUARIO/mi-vault.git
git push -u origin main
```

### 4. Activar GitHub Pages

1. Ve a tu repo en GitHub → Settings → Pages
2. Source: **Deploy from a branch**
3. Branch: `main`, folder: `/ (root)`
4. Guarda. En unos segundos tu PWA estará disponible en:
   `https://TU-USUARIO.github.io/mi-vault/`

### 5. Abrir en Android Chrome e instalar

1. Abre Chrome en Android y navega a la URL de GitHub Pages
2. Toca el menú (tres puntos) → "Instalar aplicación" (o "Add to Home screen")
3. La PWA se abrirá en modo standalone sin la barra del navegador

## Sincronización del vault

Desde la app, ve a "Sincronizar" y configura:

- **Owner**: tu usuario de GitHub
- **Repositorio**: el nombre del repo (ej: `mi-vault`)
- **Ruta**: `vault.enc` (por defecto)
- **Rama**: `main`
- **Token**: el Personal Access Token que creaste

Usa "Subir vault a GitHub" para hacer push del vault cifrado.
Usa "Descargar vault desde GitHub" para hacer pull.

El token y la configuración se guardan en localStorage. La contraseña maestra **nunca** se persiste.

## Nota sobre repos públicos

Si usas un repositorio **público**, la lectura del vault no necesita token (60 requests/hora límite
de GitHub sin autenticar). La escritura siempre necesita el token. El vault está cifrado, pero
cualquiera puede descargarlo y intentar ataques offline contra la contraseña maestra.
Usa siempre un repositorio **privado** para mayor seguridad.

## Compatibilidad

El formato del vault es compatible con el backend Python en `backend/crypto.py`.
Puedes compartir el mismo `vault.enc` entre la PWA (Android/Web) y el backend (Mac/Linux).