import React from "react";

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => {
  return (
    <div className="flex min-h-screen">
      {/* Left — decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-abysse relative overflow-hidden items-end p-12">
        <div className="absolute inset-0 bg-[url('/placeholder.svg')] bg-cover bg-center opacity-10" />
        <div className="relative z-10 max-w-md">
          <h2 className="font-serif text-4xl font-bold text-white/95 leading-tight mb-4">
            L'élégance de votre mariage commence ici
          </h2>
          <p className="font-sans text-white/60 text-sm leading-relaxed">
            Découvrez les meilleurs prestataires pour un mariage d'exception.
          </p>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-2">
            <a href="/" className="inline-block font-serif text-2xl font-bold text-gradient-or">
              LesNoces
            </a>
            <h1 className="font-serif text-3xl font-semibold text-foreground">{title}</h1>
            {subtitle && (
              <p className="font-sans text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
