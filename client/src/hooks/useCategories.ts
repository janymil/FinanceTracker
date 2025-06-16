import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";

interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
  type: "income" | "expense";
  transactionCount: number;
  isInUse: boolean;
}

// Global categories state
let globalCategories: Category[] = [];
let globalLoading = true;
let subscribers: Array<(categories: Category[], loading: boolean) => void> = [];

const notifySubscribers = () => {
  subscribers.forEach(callback => callback([...globalCategories], globalLoading));
};

const updateGlobalCategories = (categories: Category[]) => {
  globalCategories = categories;
  globalLoading = false;
  notifySubscribers();
};

const setGlobalLoading = (loading: boolean) => {
  globalLoading = loading;
  notifySubscribers();
};

export const useCategories = () => {
  const { user, isAuthenticated } = useAuth();
  const [categories, setCategories] = useState<Category[]>(globalCategories);
  const [loading, setLoading] = useState(globalLoading);

  useEffect(() => {
    const subscriber = (newCategories: Category[], newLoading: boolean) => {
      setCategories(newCategories);
      setLoading(newLoading);
    };
    
    subscribers.push(subscriber);
    
    return () => {
      subscribers = subscribers.filter(sub => sub !== subscriber);
    };
  }, []);

  const fetchCategories = async () => {
    if (!isAuthenticated || !user?.id) return;
    
    try {
      setGlobalLoading(true);
      const response = await apiRequest("GET", "/api/categories");
      const data = await response.json();
      updateGlobalCategories(data);
    } catch (error) {
      console.error("Failed to fetch categories:", error);
      updateGlobalCategories([]);
    }
  };

  const addCategory = (newCategory: Category) => {
    updateGlobalCategories([...globalCategories, newCategory]);
  };

  const updateCategory = (updatedCategory: Category) => {
    const newCategories = globalCategories.map(cat => 
      cat.id === updatedCategory.id ? updatedCategory : cat
    );
    updateGlobalCategories(newCategories);
  };

  const deleteCategory = (categoryId: number) => {
    const newCategories = globalCategories.filter(cat => cat.id !== categoryId);
    updateGlobalCategories(newCategories);
  };

  useEffect(() => {
    if (isAuthenticated && user?.id && globalCategories.length === 0) {
      fetchCategories();
    }
  }, [isAuthenticated, user?.id]);

  return {
    categories,
    loading,
    fetchCategories,
    addCategory,
    updateCategory,
    deleteCategory
  };
};