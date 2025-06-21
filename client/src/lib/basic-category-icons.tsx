// Basic category icons - keeping only 8 essential icons
import {
  DollarSign,
  Car,
  ShoppingBag,
  Utensils,
  Home,
  Heart,
  Gamepad2,
  Briefcase
} from "lucide-react";

export const basicCategoryIcons = {
  "dollar-sign": DollarSign,
  "car": Car,
  "shopping-bag": ShoppingBag,
  "utensils": Utensils,
  "home": Home,
  "heart": Heart,
  "gamepad-2": Gamepad2,
  "briefcase": Briefcase,
};

export type BasicCategoryIconName = keyof typeof basicCategoryIcons;