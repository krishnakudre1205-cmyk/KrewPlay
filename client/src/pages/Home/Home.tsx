import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Play, Tv, Users, MessageSquare, Volume2, ShieldAlert } from "lucide-react";
import logoImg from "../../assets/logo.png";

export default function Home() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" as const } },
  };

  const cardVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: "easeOut" as const } },
  };

  const features = [
    {
      icon: <Tv className="text-lavender-400 h-6 w-6" />,
      title: "Real-Time Sync",
      desc: "Perfectly synchronized movie streams. When the host pauses or seeks, everyone's player stays completely in lockstep.",
    },
    {
      icon: <MessageSquare className="text-lavender-400 h-6 w-6" />,
      title: "Instant Live Chat",
      desc: "React to the plot twists instantly. Share emojis, quick status pills, and text messages inside the cinema room.",
    },
    {
      icon: <Volume2 className="text-lavender-400 h-6 w-6" />,
      title: "Low-Latency Voice",
      desc: "Talk with your crew using our built-in low-latency audio network. Laugh and scream together as the story unfolds.",
    },
    {
      icon: <ShieldAlert className="text-lavender-400 h-6 w-6" />,
      title: "Host Lock Rights",
      desc: "Ensure uninterrupted viewings. Host can lock video player controls to prevent accidental skips or interruptions.",
    },
  ];

  return (
    <div className="flex flex-col items-center px-6 py-12 md:py-20 lg:py-24 relative z-10 w-full max-w-7xl mx-auto flex-1">
      {/* Hero Section */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="text-center max-w-4xl flex flex-col items-center mb-16 md:mb-24"
      >
        <motion.div variants={itemVariants} className="mb-8">
          <img 
            src={logoImg} 
            alt="KrewPlay Logo" 
            className="h-28 md:h-36 w-auto object-contain select-none filter drop-shadow-[0_15px_30px_rgba(0,0,0,0.6)]" 
          />
        </motion.div>

        <motion.div 
          variants={itemVariants} 
          className="mb-4 inline-flex items-center gap-2 rounded-full border border-maroon-800/40 bg-burgundy-900/30 px-4 py-1.5 text-xs font-semibold tracking-wider text-lavender-200 uppercase"
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-maroon-500" />
          The Ultimate Movie Room
        </motion.div>

        <motion.h1
          variants={itemVariants}
          className="mb-8 text-5xl md:text-7xl font-black tracking-tight leading-[1.1] text-lavender-50"
        >
          Watch Movies
          <span className="block mt-2 bg-gradient-to-r from-maroon-500 via-maroon-400 to-lavender-300 bg-clip-text text-transparent">
            Together In Perfect Sync
          </span>
        </motion.h1>

        <motion.p
          variants={itemVariants}
          className="mb-12 text-lg md:text-xl text-lavender-200/70 max-w-2xl font-light leading-relaxed"
        >
          Stream local files with friends from anywhere in the world. Enjoy low-latency voice, live messaging, and interactive reactions.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-5 justify-center w-full sm:w-auto">
          <Link
            to="/host"
            className="group relative flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-maroon-700 to-maroon-600 px-8 py-4.5 text-lg font-bold text-white transition-all duration-300 hover:from-maroon-600 hover:to-maroon-500 shadow-xl shadow-maroon-950/40 hover:shadow-maroon-700/20 hover:scale-[1.02]"
          >
            <Play className="h-5 w-5 fill-current" />
            Host Watch Room
            <div className="absolute -inset-0.5 rounded-2xl bg-lavender-400/10 opacity-0 blur group-hover:opacity-100 transition-opacity duration-300" />
          </Link>

          <Link
            to="/join"
            className="flex items-center justify-center gap-2.5 rounded-2xl border border-lavender-500/20 bg-burgundy-900/10 backdrop-blur-md px-8 py-4.5 text-lg font-semibold text-lavender-200 transition-all duration-300 hover:border-lavender-400/40 hover:bg-lavender-500/5 hover:text-lavender-50 hover:scale-[1.02]"
          >
            <Users className="h-5 w-5" />
            Join Watch Party
          </Link>
        </motion.div>
      </motion.div>

      {/* Feature Section */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full"
      >
        {features.map((feat, idx) => (
          <motion.div
            key={idx}
            variants={cardVariants}
            whileHover={{ y: -8, transition: { duration: 0.3 } }}
            className="relative overflow-hidden rounded-2xl border border-burgundy-900/40 bg-gradient-to-b from-burgundy-900/20 to-burgundy-950/40 p-6 md:p-8 backdrop-blur-sm"
          >
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-lavender-400/10 to-transparent" />
            
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-maroon-950/80 border border-maroon-900/30 text-lavender-300 shadow-inner">
              {feat.icon}
            </div>
            
            <h3 className="mb-3 text-lg font-bold tracking-wide text-lavender-100">{feat.title}</h3>
            <p className="text-sm font-light leading-relaxed text-lavender-200/50">{feat.desc}</p>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}