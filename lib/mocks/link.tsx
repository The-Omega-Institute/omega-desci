
import React from "react";
import { withBasePath } from "./basePath";

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
}

export default function Link({ href, children, className, ...props }: LinkProps) {
  const resolvedHref = withBasePath(href);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // If it's a modifier click, let browser handle it
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    
    e.preventDefault();
    window.history.pushState({}, "", resolvedHref);
  };

  return (
    <a href={resolvedHref} onClick={handleClick} className={className} {...props}>
      {children}
    </a>
  );
}
