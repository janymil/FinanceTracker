import * as Icons from 'lucide-react';
import { createElement } from 'react';

// Dynamic icon mapping for categories
export const getDynamicIcon = (iconName: string | undefined, className: string = "h-4 w-4") => {
  if (!iconName) {
    return createElement(Icons.Circle, { className });
  }

  // Check if it's a valid Lucide React icon
  const IconComponent = Icons[iconName as keyof typeof Icons] as any;
  
  if (IconComponent && typeof IconComponent === 'function') {
    return createElement(IconComponent, { className });
  }

  // Fallback to a default icon for custom/unknown categories
  return createElement(Icons.Circle, { className });
};

// Get emoji representation for backwards compatibility
export const getIconEmoji = (iconName: string | undefined): string => {
  if (!iconName) return '💰';
  
  const emojiMap: Record<string, string> = {
    'utensils': '🍽️',
    'film': '🎬', 
    'home': '🏠',
    'car': '🚗',
    'heart': '❤️',
    'shopping-bag': '🛍️',
    'dollar-sign': '💰',
    'briefcase': '💼',
    'graduation-cap': '🎓',
    'plane': '✈️',
    'gamepad-2': '🎮',
    'shirt': '👕',
    'zap': '⚡',
    'gift': '🎁',
    'laptop': '💻',
    'trending-up': '📈',
    'coffee': '☕',
    'fuel': '⛽',
    'hospital': '🏥',
    'book': '📚',
    'music': '🎵',
    'camera': '📷'
  };
  
  return emojiMap[iconName] || '💰';
};

// Check if an icon name exists in Lucide React
export const isValidLucideIcon = (iconName: string): boolean => {
  return iconName in Icons && typeof Icons[iconName as keyof typeof Icons] === 'function';
};

// For custom categories created by users or AI, we can generate appropriate fallback icons
export const getCustomCategoryIcon = (categoryName: string): string => {
  const name = categoryName.toLowerCase();
  
  // Try to map common category words to appropriate icons
  if (name.includes('food') || name.includes('restaurant') || name.includes('dining')) return 'utensils';
  if (name.includes('car') || name.includes('gas') || name.includes('fuel') || name.includes('vehicle')) return 'car';
  if (name.includes('home') || name.includes('house') || name.includes('rent') || name.includes('mortgage')) return 'home';
  if (name.includes('health') || name.includes('medical') || name.includes('doctor') || name.includes('pharmacy')) return 'heart';
  if (name.includes('shopping') || name.includes('retail') || name.includes('store')) return 'shopping-bag';
  if (name.includes('entertainment') || name.includes('movie') || name.includes('cinema')) return 'film';
  if (name.includes('work') || name.includes('business') || name.includes('office')) return 'briefcase';
  if (name.includes('education') || name.includes('school') || name.includes('university')) return 'graduation-cap';
  if (name.includes('travel') || name.includes('flight') || name.includes('vacation')) return 'plane';
  if (name.includes('gaming') || name.includes('game')) return 'gamepad-2';
  if (name.includes('clothing') || name.includes('fashion') || name.includes('clothes')) return 'shirt';
  if (name.includes('gift') || name.includes('present')) return 'gift';
  if (name.includes('tech') || name.includes('computer') || name.includes('software')) return 'laptop';
  
  // Default fallback
  return 'circle';
};