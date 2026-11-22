import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Delete } from "@/app/dashboard/Delete";
import ordersAdminApi from "@/app/util/ordersAdminApi";
import "jest-location-mock";

// 1) mock do ordersAdminApi
jest.mock("@/app/util/ordersAdminApi", () => ({
  __esModule: true,
  default: { delete: jest.fn() },
}));

// 2) mock do alert (jsdom não tem alert real)
global.alert = jest.fn();

// 3) mock do window.location.reload (jsdom não implementa)

describe("Delete", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renderiza o texto e os botões", () => {
    render(<Delete id="123" onClose={jest.fn()} />);

    expect(screen.getByText("Voce quer mesmo excluir?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sim" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Não" })).toBeInTheDocument();
  });

  it('chama onClose quando clica em "Não"', () => {
    const onClose = jest.fn();
    render(<Delete id="123" onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Não" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('chama a API de exclusão ao clicar em "Sim"', async () => {
    (ordersAdminApi.delete as jest.Mock).mockResolvedValue({});

    render(<Delete id="456" onClose={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Sim" }));

    await waitFor(() => {
      expect(ordersAdminApi.delete).toHaveBeenCalledWith("", {
        data: { id: "456" },
      });
    });

    expect(window.location.reload).toHaveBeenCalled();
  });
});

//function waitFor(arg0: () => void) {
//// throw new Error("Function not implemented.");
//}
