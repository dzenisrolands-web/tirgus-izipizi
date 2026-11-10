"use client";

import Image from "next/image";
import { useState } from "react";
import { PRODUCT_IMAGE_PLACEHOLDER, publicProductImage } from "@/lib/product-image";

export function ProductPhoto({ src, title }: { src: string; title: string }) {
  const normalized = publicProductImage(src);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return <Image src={failedSrc === normalized ? PRODUCT_IMAGE_PLACEHOLDER : normalized}
    alt={title} fill className="object-cover" priority onError={() => setFailedSrc(normalized)} />;
}
