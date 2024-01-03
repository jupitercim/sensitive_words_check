import {RouterProvider} from "react-router-dom";
import {globalRouters} from "./router";
import './popup.styl'

// 仅在调试时使用,build时要注释
// import '@/content'

function Popup() {
    return <RouterProvider router={globalRouters} />
}

export default Popup;