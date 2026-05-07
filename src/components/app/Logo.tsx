export const Logo = ({ className = "h-10 w-auto" }: { className?: string }) => (
  <div className={`flex items-center gap-2 ${className}`} style={{ height: undefined, width: undefined }}>
    <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#1A3752] text-white font-bold text-sm tracking-tight shadow-sm">
      TF
    </div>
    <span className="font-bold text-base text-[#1A3752] tracking-tight hidden sm:block">TimeFlow</span>
  </div>
);
