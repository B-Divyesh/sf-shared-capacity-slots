import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../assets/src/capacity-relief.png', import.meta.url));

await Promise.all([
  sharp(source).resize(1280, 853).avif({ quality: 54, effort: 6 }).toFile(fileURLToPath(new URL('../public/assets/capacity-relief.avif', import.meta.url))),
  sharp(source).resize(768, 512).avif({ quality: 50, effort: 6 }).toFile(fileURLToPath(new URL('../public/assets/capacity-relief-768.avif', import.meta.url))),
  sharp(source).resize(1200, 630, { fit: 'cover', position: 'centre' }).jpeg({ quality: 82, progressive: true }).toFile(fileURLToPath(new URL('../public/assets/social-card.jpg', import.meta.url))),
]);
