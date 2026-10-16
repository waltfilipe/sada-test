const SOURCES = {
  wordmark: "/brand/sada-wordmark.png",
  horizontal: "/brand/sada-lockup-horizontal.png",
  stacked: "/brand/sada-lockup-stacked.png",
  mark: "/brand/sada-mark.png",
} as const;

type Variant = keyof typeof SOURCES;

type Props = {
  variant?: Variant;
  height?: number;
  width?: number;
  className?: string;
  alt?: string;
};

export function SiteLogo({
  variant = "horizontal",
  height,
  width,
  className = "",
  alt = "SADA — Sistema de Análise de Dados de Atletas",
}: Props) {
  return (
    <img
      src={SOURCES[variant]}
      alt={alt}
      className={`site-logo site-logo-${variant} ${className}`.trim()}
      style={{
        height: height ? `${height}px` : undefined,
        width: width ? `${width}px` : undefined,
      }}
    />
  );
}
