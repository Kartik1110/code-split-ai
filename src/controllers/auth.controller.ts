import { Request, Response } from 'express';
import * as authService from '../services/auth.service';

export const signup = async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    const user = await authService.signup({ email, password, name });
    res.status(201).json({ success: true, data: user });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    res.status(401).json({ success: false, error: error.message });
  }
};

export const getUser = async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const user = await authService.getUserById(userId);
    res.status(200).json({ success: true, data: user });
  } catch (error: any) {
    res.status(404).json({ success: false, error: error.message });
  }
}; 