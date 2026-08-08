# TecnoWallet

Centro financiero personal, móvil y global para administrar cuentas, transacciones, sobres, presupuestos, metas, facturas, suscripciones y patrimonio.

## Arquitectura

- `apps/mobile`: Expo SDK 57, React Native y Expo Router.
- `apps/api`: NestJS 11, Fastify, Mongoose y REST `/api/v1`.
- `packages/contracts`: contratos compartidos de API y sincronización.
- `packages/ui`: tokens visuales compartidos.
- `packages/config`: constantes independientes del entorno.

Los módulos de negocio separan dominio, aplicación, infraestructura y presentación. El ledger es inmutable, usa unidades monetarias menores y conserva el código ISO de cada moneda.

## Desarrollo

Requisitos: Node.js 22.13 o posterior, Corepack/Yarn y MongoDB.

```bash
cp .env.example .env
corepack yarn
yarn dev:api
yarn dev:mobile
```

La documentación Swagger está disponible en `http://localhost:3000/api/docs` y el health check en `http://localhost:3000/api/v1/health`.

## Seguridad

Nunca guardes secretos en Git. Configura MongoDB, JWT y proveedores externos mediante variables de entorno. Las operaciones financieras aceptan claves de idempotencia y el acceso a espacios compartidos se valida en servidor.

## Render

El archivo `render.yaml` conserva los comandos requeridos:

- Build: `YARN_PRODUCTION=false yarn install --frozen-lockfile` (el `postinstall` compila la API)
- Start: `yarn start` → `yarn workspace api start:prod` (si falta `dist`, lo genera)

**Importante en el dashboard de Render** (Settings → Build & Deploy), usa exactamente esos comandos. Si el servicio no tiene acceso al repo de GitHub, vuelve a conectar el repositorio o el deploy quedará en un commit viejo.

Deploy manual con el hook (URL solo en `.env` como `RENDER_DEPLOY_HOOK`):

```bash
curl -X POST "$RENDER_DEPLOY_HOOK"
```

## Hostinger (frontend)

La carpeta [`HOST/`](HOST/) es el paquete del front estático:

```bash
EXPO_PUBLIC_API_URL=https://TU-API.onrender.com/api/v1 yarn export:host
```

Sube `HOST/tecnowallet-public-html.zip` a `public_html` en Hostinger.
