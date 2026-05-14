import '@/styles/globals.css'
import { AppProvider } from '@/providers/AppProvider'

export const metadata = {
    other: {
        "talentapp:project_verification":
            "449bc4472ca4cfb6b0fea41d9faf64bad1844b04d812b9b5e66dc47e65f403351099a9d6276099867ac61074b88b2949aafd9e5b1f558f68f4df3a5dcc202002",
    },
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body style={{
                margin: 0,
                padding: 0,
                overflow: "hidden",
                height: "100vh",
                width: "100vw"
            }}>
                <AppProvider>
                    {children}
                </AppProvider>
            </body>
        </html>
    )
}