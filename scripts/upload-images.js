#!/usr/bin/env node

/**
 * Script para subir imágenes de ejemplo a S3 - Fase 5
 * 
 * Uso:
 *   node scripts/upload-images.js --bucket <bucket-name> --region <region>
 * 
 * Ejemplo:
 *   node scripts/upload-images.js --bucket cromos-stickers-123456789-us-east-1 --region us-east-1
 * 
 * Nota: Requiere AWS CLI configurado o AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY
 */

const fs = require('fs');
const path = require('path');

// Parse CLI arguments
const args = process.argv.slice(2);
let bucketName = null;
let region = 'us-east-1';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--bucket' && i + 1 < args.length) {
    bucketName = args[i + 1];
    i++;
  }
  if (args[i] === '--region' && i + 1 < args.length) {
    region = args[i + 1];
    i++;
  }
}

if (!bucketName) {
  console.error('\n❌ Error: Se requiere especificar el nombre del bucket');
  console.error('\nUso:');
  console.error('  node scripts/upload-images.js --bucket <bucket-name> --region <region>\n');
  console.error('Ejemplo:');
  console.error('  node scripts/upload-images.js --bucket cromos-stickers-123456789-us-east-1 --region us-east-1\n');
  process.exit(1);
}

// Imágenes de ejemplo a crear (placeholders)
const imagesToCreate = {
  'stickers/placeholder.jpg': 'Placeholder general de cromo',
  'stickers/placeholder-001.jpg': 'Placeholder cromo #001',
  'stickers/placeholder-002.jpg': 'Placeholder cromo #002',
  'stickers/placeholder-003.jpg': 'Placeholder cromo #003',
  'stickers/placeholder-099.jpg': 'Placeholder cromo #099 (Messi)',
  'stickers/players/placeholder.jpg': 'Placeholder foto de jugador',
  'stickers/players/messi.jpg': 'Foto: Lionel Messi',
  'stickers/players/ronaldo.jpg': 'Foto: Cristiano Ronaldo',
  'stickers/players/caicedo.jpg': 'Foto: Moisés Caicedo',
  'stickers/players/vinicius.jpg': 'Foto: Vinicius Jr',
  'stickers/teams/placeholder.png': 'Placeholder logo de equipo',
  'stickers/teams/argentina.png': 'Logo: Argentina',
  'stickers/teams/portugal.png': 'Logo: Portugal',
  'stickers/teams/france.png': 'Logo: Francia',
  'stickers/teams/brazil.png': 'Logo: Brasil',
  'stickers/teams/spain.png': 'Logo: España',
  'stickers/teams/england.png': 'Logo: Inglaterra',
  'stickers/teams/germany.png': 'Logo: Alemania',
  'stickers/teams/netherlands.png': 'Logo: Países Bajos',
  'stickers/teams/ecuador.png': 'Logo: Ecuador',
  'stickers/flags/placeholder.png': 'Placeholder bandera de país',
  'stickers/flags/argentina.png': 'Bandera: Argentina',
  'stickers/flags/portugal.png': 'Bandera: Portugal',
  'stickers/flags/france.png': 'Bandera: Francia',
  'stickers/flags/brazil.png': 'Bandera: Brasil',
  'stickers/flags/spain.png': 'Bandera: España',
  'stickers/flags/england.png': 'Bandera: Inglaterra',
  'stickers/flags/germany.png': 'Bandera: Alemania',
  'stickers/flags/netherlands.png': 'Bandera: Países Bajos',
  'stickers/flags/ecuador.png': 'Bandera: Ecuador'
};

const instructions = `
╔═══════════════════════════════════════════════════════════════════════╗
║                  UPLOAD DE IMÁGENES - Fase 5                         ║
╠═══════════════════════════════════════════════════════════════════════╣
║                                                                       ║
║ Este script prepara los comandos para subir imágenes a S3             ║
║                                                                       ║
║ Bucket: ${bucketName}
║ Región: ${region}
║ Imágenes: ${Object.keys(imagesToCreate).length}
║                                                                       ║
╠═══════════════════════════════════════════════════════════════════════╣
║                    OPCIÓN 1: USAR AWS CLI                            ║
╠═══════════════════════════════════════════════════════════════════════╣
║                                                                       ║
║ Paso 1: Instalar AWS CLI                                             ║
║   https://aws.amazon.com/cli/                                        ║
║                                                                       ║
║ Paso 2: Configurar credenciales                                      ║
║   aws configure                                                       ║
║                                                                       ║
║ Paso 3: Crear directorio con imágenes de ejemplo                     ║
║   mkdir -p cromos-images/stickers/{players,teams,flags}              ║
║                                                                       ║
║ Paso 4: Crear imágenes placeholder (JPG vacíos)                      ║`;

console.log(instructions);

// Generar comandos AWS CLI para cada imagen
console.log('║ Paso 5: Ejecutar estos comandos:                                    ║');
console.log('║                                                                       ║');

for (const [imagePath, description] of Object.entries(imagesToCreate)) {
  const uploadCmd = `║ aws s3 cp dummy.jpg s3://${bucketName}/${imagePath} --region ${region}`;
  console.log(uploadCmd.padEnd(73) + '║');
}

const consoleOutput = `
╠═══════════════════════════════════════════════════════════════════════╣
║                   OPCIÓN 2: USAR ESTE SCRIPT BASH                   ║
╠═══════════════════════════════════════════════════════════════════════╣
║                                                                       ║
║ Crear archivo: upload-to-s3.sh                                       ║
║                                                                       ║
║ #!/bin/bash                                                          ║
║ BUCKET="${bucketName}"                                               ║
║ REGION="${region}"                                                   ║
║                                                                       ║
║ # Crear archivo dummy                                                ║
║ dd if=/dev/zero bs=1K count=10 of=dummy.jpg                          ║
║                                                                       ║
║ # Subir todas las imágenes`;

console.log(consoleOutput);

// Generar comandos para cada imagen
let uploadCommands = '';
for (const [imagePath] of Object.entries(imagesToCreate)) {
  uploadCommands += `║ aws s3 cp dummy.jpg s3://\$BUCKET/${imagePath} --region \$REGION\n`;
}

console.log(uploadCommands);

const endInstructions = `║                                                                       ║
║ Luego ejecutar:                                                      ║
║   chmod +x upload-to-s3.sh                                           ║
║   ./upload-to-s3.sh                                                  ║
║                                                                       ║
╠═══════════════════════════════════════════════════════════════════════╣
║                      OPCIÓN 3: USAR CONSOLA AWS                     ║
╠═══════════════════════════════════════════════════════════════════════╣
║                                                                       ║
║ 1. Ir a: https://console.aws.amazon.com/s3/                         ║
║ 2. Seleccionar bucket: ${bucketName}
║ 3. Crear carpetas:                                                   ║
║    - stickers/                                                       ║
║    - stickers/players/                                               ║
║    - stickers/teams/                                                 ║
║    - stickers/flags/                                                 ║
║ 4. Subir imágenes manualmente                                        ║
║                                                                       ║
╠═══════════════════════════════════════════════════════════════════════╣
║                      OPCIÓN 4: USAR JAVASCRIPT                       ║
╠═══════════════════════════════════════════════════════════════════════╣
║                                                                       ║
║ Requiere AWS SDK para JavaScript:                                   ║
║   npm install @aws-sdk/client-s3                                     ║
║                                                                       ║
║ Crear archivo: upload-to-s3.js                                       ║
║                                                                       ║
║ const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
║                                                                       ║
║ const client = new S3Client({ region: '${region}' });                 ║
║ const bucket = '${bucketName}';                                      ║
║                                                                       ║
║ async function uploadImages() {                                      ║
║   const files = ${JSON.stringify(Object.keys(imagesToCreate), null, 5)};
║                                                                       ║
║   for (const file of files) {                                        ║
║     await client.send(new PutObjectCommand({                         ║
║       Bucket: bucket,                                                ║
║       Key: file,                                                     ║
║       Body: Buffer.alloc(10240) // 10KB dummy                       ║
║     }));                                                              ║
║     console.log(\`✓ Subido: \${file}\`);                              ║
║   }                                                                   ║
║ }                                                                     ║
║                                                                       ║
║ uploadImages().catch(console.error);                                 ║
║                                                                       ║
╠═══════════════════════════════════════════════════════════════════════╣
║                     VERIFICAR UPLOADS                                 ║
╠═══════════════════════════════════════════════════════════════════════╣
║                                                                       ║
║ aws s3 ls s3://${bucketName}/stickers/ --region ${region} --recursive
║                                                                       ║
║ O desde consola AWS:                                                  ║
║ https://console.aws.amazon.com/s3/buckets/${bucketName}             ║
║                                                                       ║
╠═══════════════════════════════════════════════════════════════════════╣
║                      ACCEDER A LAS IMÁGENES                          ║
╠═══════════════════════════════════════════════════════════════════════╣
║                                                                       ║
║ Vía S3 directo:                                                      ║
║ https://${bucketName}.s3.${region}.amazonaws.com/stickers/...      ║
║                                                                       ║
║ Vía CloudFront (mejor performance, con caché):                       ║
║ https://{CLOUDFRONT_DOMAIN}/stickers/...                             ║
║                                                                       ║
║ Ejemplo de respuesta de API con imagen:                              ║
║ GET /stickers/001                                                    ║
║ {                                                                     ║
║   "id": "sticker-001",                                               ║
║   "imageUrl": "/stickers/placeholder-001.jpg",                       ║
║   "playerImage": "/stickers/players/placeholder.jpg",                ║
║   ...                                                                 ║
║ }                                                                     ║
║                                                                       ║
║ Nota: En desarrollo, las URLs son relativas.                         ║
║ En producción, se reemplazarán con URL completa de CloudFront.       ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
`;

console.log(endInstructions);

// También generar un archivo con los comandos listos para copiar-pegar
const commandsFile = path.join(__dirname, 'upload-commands.txt');
const commandsContent = `# Comandos para subir imágenes a S3
# Usa con AWS CLI: aws s3 cp <archivo> s3://<bucket>/<ruta>

# Crear archivo dummy de 10KB
dd if=/dev/zero bs=1K count=10 of=dummy.jpg

# Subir todas las imágenes
${Object.keys(imagesToCreate).map(img => `aws s3 cp dummy.jpg s3://${bucketName}/${img} --region ${region}`).join('\n')}

# Verificar uploads
aws s3 ls s3://${bucketName}/stickers/ --region ${region} --recursive

# Limpiar
rm dummy.jpg
`;

fs.writeFileSync(commandsFile, commandsContent);
console.log(`\n✓ Comandos guardados en: ${commandsFile}\n`);

module.exports = {
  imagesToCreate,
  bucketName,
  region
};
