import { Separator } from "@s3-viewer/ui/components/separator";

export default function Hero() {
    return (
        <div className="flex h-20 py-4 gap-4 items-center">
            <div className="flex flex-2 justify-between">
                <h1>Server</h1>
                <h1>Total Storage</h1>
            </div>
            <Separator orientation="vertical" decorative />
            <div className="flex-1">
                <h1>Operation A</h1>
            </div>
            <Separator orientation="vertical" decorative />
            <div className="flex-1">
                <h1>Operation B</h1>
            </div>
        </div>
    )
}
