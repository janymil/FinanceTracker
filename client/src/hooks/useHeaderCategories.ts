import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";

interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
  type: "income" | "expense";
}

export const useHeaderCategories = () => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);

  const fetchCategories = async () => {
    if (!user?.id) return;
    
    try {
      const response = await apiRequest("GET", "/api/categories");
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error("Failed to fetch categories:", error);
      setCategories([]);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [user?.id]);

  return { categories };
};