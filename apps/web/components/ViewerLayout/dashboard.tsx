import ViewerBanner from "./banner";
import { ViewerSidebar } from "./sidebar";

const ViewerDashboard = ( {children} : {children: React.ReactNode}) => {
    return (
        <ViewerBanner>
            <ViewerSidebar />
            {children}
        </ViewerBanner>
    )
}

export default ViewerDashboard;