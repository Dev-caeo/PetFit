export interface PetProfile {
  id: string;
  name: string;
  species: 'dog' | 'cat';
  breed: string;
  age: number;
  weight: number;
  targetWeight: number;
  dailyCalorieTarget: number;
  photoUrl?: string;
}

export type MealCategory = 'Café da manhã' | 'Almoço' | 'Jantar' | 'Snacks';

export interface CalorieLog {
  id: string;
  date: string;
  type: 'intake' | 'expenditure';
  amount: number;
  description: string;
  category?: MealCategory;
  portionWeight?: number;
}

export interface MealOption {
  id: string;
  name: string;
  calories: number;
  category: MealCategory;
  description: string;
  image?: string;
}

export interface DailySummary {
  date: string;
  intake: number;
  expenditure: number;
}
