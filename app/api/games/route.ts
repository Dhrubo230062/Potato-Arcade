import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic'; // never cache — always re-scan ROMs
export const revalidate = 0;

const ROM_MAPPING: Record<string, string> = {
  'mslug': 'Metal Slug',
  'mslug2': 'Metal Slug 2',
  'mslug3': 'Metal Slug 3',
  'mslug4': 'Metal Slug 4',
  'mslug5': 'Metal Slug 5',
  'mslugx': 'Metal Slug X',
  'kof94': "The King of Fighters '94",
  'kof95': "The King of Fighters '95",
  'kof96': "The King of Fighters '96",
  'kof97': "The King of Fighters '97",
  'kof98': "The King of Fighters '98",
  'kof99': "The King of Fighters '99",
  'kof2000': 'The King of Fighters 2000',
  'kof2001': 'The King of Fighters 2001',
  'kof2002': 'The King of Fighters 2002',
  'kof2003': 'The King of Fighters 2003',
  'samsho': 'Samurai Shodown',
  'samsho2': 'Samurai Shodown II',
  'samsho3': 'Samurai Shodown III',
  'samsho4': 'Samurai Shodown IV',
  'samsho5': 'Samurai Shodown V',
  'fatfury1': 'Fatal Fury',
  'fatfury2': 'Fatal Fury 2',
  'fatfury3': 'Fatal Fury 3',
  'rbff1': 'Real Bout Fatal Fury',
  'rbffspec': 'Real Bout Fatal Fury Special',
  'rbff2': 'Real Bout Fatal Fury 2',
  'garou': 'Garou: Mark of the Wolves',
  'lastblad': 'The Last Blade',
  'lastbld2': 'The Last Blade 2',
  'neobombe': 'Neo Bomberman',
  'maglord': 'Magician Lord',
  'viewpoin': 'Viewpoint',
  'pulstar': 'Pulstar',
  'blazstar': 'Blazing Star',
  'shocktro': 'Shock Troopers',
  'shocktr2': 'Shock Troopers: 2nd Squad',
  'wjammers': 'Windjammers',
  'turfmast': 'Neo Turf Masters',
  'stakwin': 'Stakes Winner',
  'stakwin2': 'Stakes Winner 2',
  'puzzledp': 'Puzzle Bobble',
  'puzzled2': 'Puzzle Bobble 2',
  'magdrop2': 'Magical Drop II',
  'magdrop3': 'Magical Drop III',
  'aof': 'Art of Fighting',
  'aof2': 'Art of Fighting 2',
  'aof3': 'Art of Fighting 3',
  'sengoku': 'Sengoku',
  'sengoku2': 'Sengoku 2',
  'sengoku3': 'Sengoku 3',
  'wh1': 'World Heroes',
  'wh2': 'World Heroes 2',
  'wh2jet': 'World Heroes 2 Jet',
  'whp': 'World Heroes Perfect',
  'kabukikl': 'Far East of Eden: Kabuki Klash',
  'wakuwak7': 'Waku Waku 7',
  'gowcaizr': 'Voltage Fighter: Gowcaizer',
  'doubledr': 'Double Dragon',
  'matrim': 'Matrimelee',
  'svc': 'SVC Chaos: SNK vs. Capcom',
  'snkvscap': 'SNK vs. Capcom: SVC Chaos',
  'rotd': 'Rage of the Dragons',
  'breakers': 'Breakers',
  'breakrev': 'Breakers Revenge',
  'karnovr': "Karnov's Revenge",
  'fightfev': 'Fight Fever',
  'galaxyfg': 'Galaxy Fight',
  'lasthope': 'Last Hope',
  'faststri': 'Fast Striker',
  'gunlord': 'Gunlord',
  'razion': 'Razion',
  'xyx': 'XYX',
  'neoxyx': 'Neo XYX',
  'mario': 'Super Mario Bros',
  'dkong': 'Donkey Kong',
  'galaga': 'Galaga',
  'pacman': 'Pac-Man',
  'sf2': 'Street Fighter II',
  'sf2ce': 'Street Fighter II CE',
  'ssf2t': 'Super Street Fighter II Turbo',
  'mk': 'Mortal Kombat',
  'tmnt': 'Teenage Mutant Ninja Turtles',
  'simpsons': 'The Simpsons',
};

export async function GET() {
  const romsDir = path.join(process.cwd(), 'public', 'roms');
  const imagesDir = path.join(process.cwd(), 'public', 'image');
  let detectedGames: any[] = [];

  const scanRoms = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        scanRoms(fullPath);
      } else if (file.endsWith('.zip') && file !== 'neogeo.zip') {
        const relativePath = path.relative(path.join(process.cwd(), 'public', 'roms'), fullPath);
        const filename = file.replace('.zip', '');
        
        let name = ROM_MAPPING[filename] || filename
          .split(/[-_]/)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

        // Check for local image first (case-insensitive)
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.PNG', '.JPG', '.JPEG', '.WEBP'];
        let imageUrl: string | null = null;

        if (fs.existsSync(imagesDir)) {
          // List actual files and find case-insensitive match
          const imageFiles = fs.readdirSync(imagesDir);
          const match = imageFiles.find(f => {
            const base = f.toLowerCase().replace(/\.(png|jpg|jpeg|webp)$/, '');
            return base === filename.toLowerCase();
          });
          if (match) {
            imageUrl = `/image/${match}`;
          }
        }

        // Libretro CDN fallback
        if (!imageUrl) {
          const encodedName = encodeURIComponent(name);
          imageUrl = `https://thumbnails.libretro.com/FBNeo%20-%20Arcade%20Games/Named_Titles/${encodedName}.png`;
        }

        detectedGames.push({
          name: name,
          filename: relativePath,
          slug: filename,
          image: imageUrl
        });
      }
    }
  };

  try {
    scanRoms(romsDir);
  } catch (error) {
    console.error('Error scanning ROMs directory:', error);
  }


    return NextResponse.json(detectedGames);
}
