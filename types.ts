export interface Clip {
  title: string;
  description: string;
  tags: string[];
  startTime: string;
  endTime: string;
  videoId: string;
  transcript: string;
}

export type UserPlan = 'free' | 'casual' | 'mastermind';

export interface User {
  loggedIn: boolean;
  name: string;
  email: string;
  plan: UserPlan;
  usage: {
    videosProcessed: number;
    minutesProcessed: number;
    lastReset: string; // YYYY-MM format
  };
}
