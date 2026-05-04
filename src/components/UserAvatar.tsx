import React from 'react';

interface AvatarStyles {
  top: string;
  topColor: string;
  facialHairColor?: string;
  accessoriesColor?: string;
  skinColor: string;
  clothingColor: string;
  eyes: string;
  mouth: string;
  glasses: string;
  facialHair: string;
  clothes: string;
}

interface UserAvatarProps {
  styles?: AvatarStyles;
  seed?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  rainbow?: boolean;
}

export default function UserAvatar({ styles, seed, className = "", size, rainbow = false }: UserAvatarProps) {
  // Size mapping
  const sizeClasses: Record<string, string> = {
    sm: 'w-8 h-8 rounded-lg',
    md: 'w-10 h-10 rounded-xl',
    lg: 'w-12 h-12 rounded-[18px]',
    xl: 'w-40 h-40 rounded-[48px]'
  };

  const currentSize = size ? sizeClasses[size] : '';

  // If we don't have styles, we fallback to a simple seed-based avatar
  if (!styles) {
    const fallbackUrl = `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed || 'anon'}`;
    return (
      <div className={`${currentSize} bg-moss-900 border border-white/5 overflow-hidden flex-shrink-0 ${className} ${rainbow ? 'ring-2 ring-transparent bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 animate-gradient-x border-none' : ''}`}>
        <img src={fallbackUrl} alt="Avatar" className="w-full h-full object-cover" />
      </div>
    );
  }

  const hairHex = styles.topColor.replace('#', '');
  const facialHairHex = (styles.facialHairColor || '2c1b18').replace('#', '');
  const skinHex = styles.skinColor.replace('#', '');
  const clothHex = styles.clothingColor.replace('#', '');
  const accessoryHex = (styles.accessoriesColor || '262e33').replace('#', '');
  
  const topParam = styles.top === 'careca' ? 'topProbability=0' : `top=${styles.top}&topProbability=100`;
  const facialHairParam = styles.facialHair === 'blank' ? 'facialHairProbability=0' : `facialHair=${styles.facialHair}&facialHairProbability=100`;
  const accessoryParam = styles.glasses === 'blank' ? 'accessoriesProbability=0' : `accessories=${styles.glasses}&accessoriesProbability=100`;
  const clothingParam = `clothing=${styles.clothes}&clothingProbability=100`;
  
  const avatarUrl = `https://api.dicebear.com/9.x/avataaars/svg?${topParam}&${facialHairParam}&${accessoryParam}&${clothingParam}&topColor=${hairHex}&hairColor=${hairHex}&facialHairColor=${facialHairHex}&accessoriesColor=${accessoryHex}&skinColor=${skinHex}&clothingColor=${clothHex}&clothesColor=${clothHex}&eyes=${styles.eyes}&mouth=${styles.mouth}&clothingGraphic[]`;

  return (
    <div className={`${currentSize} bg-moss-900 border border-white/5 overflow-hidden relative flex-shrink-0 ${className} ${rainbow ? 'p-[3px] bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 bg-[length:400%_400%] animate-gradient-x border-none shadow-[0_0_20px_rgba(255,255,255,0.2)]' : ''}`}>
      <div className={`w-full h-full rounded-inherit overflow-hidden bg-moss-900 ${rainbow ? 'rounded-[inherit]' : ''}`}>
        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
        
        {/* CAMADA DE BRISA: Olhos Vermelhos "Na Marra" */}
        {/* Usando os valores ajustados pelo usuário (37.5%) */}
        {styles.eyes === 'squint' && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Olho Esquerdo */}
            <div 
              className="absolute bg-red-600/40 blur-[1px] rounded-full mix-blend-multiply"
              style={{ top: '36.9%', left: '36.3%', width: '9.1%', height: '5.9%' }}
            />
            {/* Olho Direito */}
            <div 
              className="absolute bg-red-600/40 blur-[1px] rounded-full mix-blend-multiply"
              style={{ top: '37%', left: '54.5%', width: '9.1%', height: '6%' }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
