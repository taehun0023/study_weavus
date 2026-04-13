import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";

const ToastProvider = ToastPrimitives.Provider;
const ToastViewport = ToastPrimitives.Viewport;
const Toast = ToastPrimitives.Root;
const ToastTitle = ToastPrimitives.Title;
const ToastDescription = ToastPrimitives.Description;
const ToastClose = ToastPrimitives.Close;
const ToastAction = ToastPrimitives.Action;

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;
type ToastActionElement = React.ReactElement<typeof ToastAction>;

export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
};
export type { ToastProps, ToastActionElement };
