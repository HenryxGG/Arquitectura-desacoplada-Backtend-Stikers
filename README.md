# Backend — Cromos del Mundial Cloud Edition

Backend serverless para la aplicación de colección de cromos del Mundial. Construido con AWS SAM, Node.js 24.x, Lambda, API Gateway y DynamoDB.

## Estructura del proyecto

```
cromos-backend-cloud-demo/
├── template.yaml              # Infraestructura como código (SAM/CloudFormation)
├── samconfig.toml             # Configuración del deploy
├── src/
│   ├── handlers/              # Una función Lambda por recurso
│   │   ├── root.js
│   │   ├── health.js
│   │   ├── countries.js
│   │   ├── teams.js
│   │   ├── players.js
│   │   └── stickers.js
│   ├── utils/
│   │   ├── response.js        # Helpers de respuesta HTTP con CORS
│   │   ├── cognito.js         # Extracción del usuario autenticado
│   │   ├── http.js            # Método y path del evento
│   │   ├── request.js         # Parse de body JSON
│   │   ├── logger.js          # Logging estructurado
│   │   └── local-data.js      # Datos estáticos de respaldo
│   └── data/                  # Datos locales de respaldo (jugadores, equipos, etc.)
└── scripts/
    └── upload-images.js       # Script para subir imágenes al bucket S3
```

## Recursos AWS creados por el stack

- **API Gateway REST** — `cromos-backend-shared-rest-api-shared`
- **6 funciones Lambda** — una por handler
- **DynamoDB** — tabla `cromos-db-shared` (PAY_PER_REQUEST, single-table)
- **S3 Bucket** — `cromos-images-bucket-553916358985` (imágenes de cromos)
- **CloudFront** — distribución para el bucket de imágenes
- **Cognito User Pool** — `cromos-users-shared` con cliente `cromos-react-client`
- **IAM Role** — `cromos-backend-lambda-role-shared` con mínimo privilegio

## IAM — Mínimo privilegio

El rol Lambda tiene acceso explícito solo a lo necesario:

- **CloudWatch Logs:** `CreateLogGroup`, `CreateLogStream`, `PutLogEvents`
- **S3:** `GetObject`, `ListBucket`, `PutObject` sobre el bucket de imágenes únicamente
- **DynamoDB:** `PutItem`, `GetItem`, `Scan`, `Query`, `UpdateItem`, `DeleteItem` sobre la tabla del stack

## Upload de imágenes

El endpoint `POST /stickers/{id}/upload-url` genera una presigned URL de S3 válida 5 minutos. El cliente hace `PUT` directo a S3 con el archivo — Lambda nunca recibe los bytes de la imagen.

```
Frontend → POST /stickers/{id}/upload-url → Lambda genera presigned URL
Frontend → PUT <presigned-url> (directo a S3) → imagen guardada
CloudFront → sirve la imagen automáticamente
```
