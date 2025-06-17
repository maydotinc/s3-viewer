import {
    Dialog,
    DialogContent,
    DialogTrigger
} from "@s3-viewer/ui/components/dialog";
import { PenLine } from "lucide-react";

const ServerEdit = () => {
    return (
        <Dialog>
            <DialogTrigger>
                <div className="flex items-center gap-2">
                    <PenLine className="size-4" />
                    Edit
                </div>
            </DialogTrigger>
            <DialogContent>
                <h1>Hola</h1>
            </DialogContent>
        </Dialog>
    )
}

export default ServerEdit;