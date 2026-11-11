import axios from "axios";
const ordersAdminApi = axios.create({ baseURL: "/api/orders/admin" });
export default ordersAdminApi;
