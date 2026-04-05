import { motion } from 'framer-motion';

export const GlassPanel = ({ children, delay = 0, className = '', style, ...props }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
    className={`glass-panel flex min-h-0 flex-col ${className}`}
    style={style}
    {...props}
  >
    {children}
  </motion.div>
);

export const GlassCard = ({ children, delay = 0, className = '', style, ...props }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay }}
    whileHover={{ y: -1 }}
    className={`glass-card ${className}`}
    style={style}
    {...props}
  >
    {children}
  </motion.div>
);
