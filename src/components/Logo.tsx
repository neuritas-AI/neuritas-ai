import logo from "@/assets/neuritas-logo.png";

export function Logo({ className = "h-8", showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  if (showWordmark) {
    return <img src={logo} alt="Neuritas-AI" className={className} />;
  }
  return <img src={logo} alt="Neuritas-AI" className={className} style={{ objectFit: "contain", objectPosition: "left" }} />;
}

export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  // Crops to just the brain icon part (~22% of the logo width)
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <img src={logo} alt="" className="absolute h-full" style={{ left: 0, width: "auto", maxWidth: "none", aspectRatio: "1349/482" }} />
    </div>
  );
}
