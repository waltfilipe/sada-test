type Props = {
  height?: number;
  width?: number;
  className?: string;
};

export function SiteLogo({ height, width, className = "" }: Props) {
  return (
    <img
      src="/brand/logo.png"
      alt="SADA — Sistema de Análise de Dados de Atletas"
      className={`site-logo ${className}`.trim()}
      style={{
        height: height ? `${height}px` : "auto",
        width: width ? `${width}px` : "auto",
      }}
    />
  );
}
