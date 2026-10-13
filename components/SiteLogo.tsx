type Props = {
  height?: number;
  width?: number;
  className?: string;
};

export function SiteLogo({ height, width, className = "" }: Props) {
  return (
    <img
      src="/brand/logo.png"
      alt="Logo"
      className={`site-logo ${className}`.trim()}
      style={{
        height: height ? `${height}px` : "auto",
        width: width ? `${width}px` : "auto",
      }}
    />
  );
}
