import express, { Request, Response, Router } from "express";
import * as Sentry from "@sentry/node";
import logger, { Logger } from "../services/logger";

// Create a specific logger for error routes
const errorLogger = new Logger("error-routes");

const router = Router();

// Test route that will throw an error for Sentry to capture
router.get("/test-error", (req: Request, res: Response) => {
  try {
    // Intentionally throw an error
    throw new Error("This is a test error for Sentry monitoring");
  } catch (error) {
    // Capture the error with our logger
    errorLogger.captureException(error as Error, {
      route: "/api/error/test-error",
      requestHeaders: req.headers,
    });
    res
      .status(500)
      .json({ message: "Test error triggered and captured by Sentry" });
  }
});

// Another test route that will crash the request for Sentry to automatically capture
router.get("/crash-test", (req: Request, res: Response) => {
  // This will throw an error that is not caught
  const obj: any = null;
  obj.nonExistentMethod(); // This will cause a runtime error
  res.status(200).json({ message: "You should not see this message" });
});

// Route that logs different levels of messages
router.get("/log-levels", (req: Request, res: Response) => {
  // Log different levels of messages to Sentry via our logger
  errorLogger.debug("This is a debug message", {
    route: "/api/error/log-levels",
  });
  errorLogger.info("This is an info message", {
    route: "/api/error/log-levels",
  });
  errorLogger.warn("This is a warning message", {
    route: "/api/error/log-levels",
  });
  errorLogger.error("This is an error message", {
    route: "/api/error/log-levels",
  });
  errorLogger.fatal("This is a fatal message", {
    route: "/api/error/log-levels",
  });

  res
    .status(200)
    .json({ message: "Various log levels have been sent to Sentry" });
});

export default router;
