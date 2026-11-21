import type { DetailedHTMLProps, HTMLAttributes } from "react";

type ModelViewerAttributes = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  src?: string;
  "ios-src"?: string;
  poster?: string;
  alt?: string;
  ar?: boolean;
  "ar-modes"?: string;
  "ar-scale"?: "auto" | "fixed";
  "ar-placement"?: "floor" | "wall";
  "camera-controls"?: boolean;
  "touch-action"?: string;
  "shadow-intensity"?: string;
  "environment-image"?: string;
  exposure?: string;
  scale?: string;
  loading?: "auto" | "lazy" | "eager";
  reveal?: "auto" | "manual";
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": ModelViewerAttributes;
    }
  }
}
