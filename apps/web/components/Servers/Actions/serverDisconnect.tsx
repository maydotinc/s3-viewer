import { Button } from "@s3-viewer/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@s3-viewer/ui/components/dialog";
import { Server, WifiOff } from "lucide-react";
import { useState } from "react";

const ServerDisconnect = () => {
    const [isOpen, setIsOpen] = useState(false);

    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger className="w-full">
                <div className="flex items-center gap-2 cursor-pointer size-full">
                    <WifiOff className="size-4 text-viewertextred" />
                    Disconnect Server
                </div>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader className="flex flex-col gap-2 items-center text-center">
                    <div className="bg-viewergray border border-viewerborder rounded-2xl p-3 mb-2">
                        <Server className="size-10 text-viewerblue" />
                    </div>
                    <DialogTitle>Disconnect Server</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to disconnect this server? You will need to reconnect the server manually to use it again.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline" className="flex-1">Cancel</Button>
                    </DialogClose>
                    <DialogClose asChild>
                        <Button variant="destructive" className="flex-1">Disconnect</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default ServerDisconnect;