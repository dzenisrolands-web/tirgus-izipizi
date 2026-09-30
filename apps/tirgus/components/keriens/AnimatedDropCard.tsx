"use client";

import { motion } from "framer-motion";
import { DropCard } from "./DropCard";
import type { HotDropWithSeller } from "@/lib/hot-drops/types";

export function AnimatedDropCard({ drop, index }: { drop: HotDropWithSeller; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: "easeOut" }}
    >
      <DropCard drop={drop} />
    </motion.div>
  );
}
