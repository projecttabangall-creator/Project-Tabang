import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

interface BackButtonProps {
  to?: string;
  label?: string;
}

export function BackButton({ to, label = "Back" }: BackButtonProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (to) {
      navigate(to);
    } else {
      navigate(-1);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium text-sm mb-4 transition-colors"
      title={label}
    >
      <ChevronLeft size={18} />
      <span>{label}</span>
    </button>
  );
}
