import fs from 'fs';
import path from 'path';

const src = 'C:/Users/Hugo/Documents/Code Projets/PvZ2 Clicker Wars/crystal.png';
const dest = 'C:/Users/Hugo\Documents/Code Projets/PvZ2 Clicker Wars/PvZ-Clicker-Wars/public/crystal.png';

fs.copyFile(src, dest, (err) => {
  if (err) console.error('Error:', err);
  else console.log('Copied successfully!');
});
