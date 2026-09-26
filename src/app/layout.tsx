import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
const geist=Geist({subsets:["latin"],variable:"--font-geist"});
export const metadata:Metadata={title:{default:"SafeSpace","template":"%s · SafeSpace"},description:"Spatial safety assessment for safer ageing environments"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body className={geist.variable}><a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-white focus:p-3">Skip to content</a>{children}</body></html>}
