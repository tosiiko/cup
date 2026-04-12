package dev.tosiiko.cup.examples;

import dev.tosiiko.cup.CupValidator;
import dev.tosiiko.cup.FetchAction;
import dev.tosiiko.cup.UIView;
import dev.tosiiko.cup.ViewPolicy;

public final class BasicExample {
    private BasicExample() {}

    public static void main(String[] args) {
        UIView view = new UIView("<h1>{{ title }}</h1><button data-action=\"refresh\">Refresh</button>")
            .state("title", "Accounts")
            .action("refresh", new FetchAction("/api/accounts").method("GET"))
            .title("Accounts")
            .route("/accounts");

        CupValidator.validateViewPolicy(view.toMap(), ViewPolicy.starter());
        System.out.println(view.toJson());
    }
}
