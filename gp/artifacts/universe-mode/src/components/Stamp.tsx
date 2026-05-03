import { motion } from "framer-motion";

export function Stamp({ text }: { text: string }) {
  return (
    <motion.div
      initial={{ scale: 2.5, opacity: 0, rotate: -15 }}
      animate={{ scale: 1, opacity: 1, rotate: -5 }}
      transition={{ 
        type: "spring", 
        damping: 15, 
        stiffness: 150,
        delay: 0.3 
      }}
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20"
    >
      <div className="border-4 border-foreground text-foreground font-display text-4xl sm:text-6xl font-bold uppercase px-6 py-2 tracking-widest backdrop-blur-sm bg-background/50 shadow-2xl">
        {text}
      </div>
    </motion.div>
  );
}
