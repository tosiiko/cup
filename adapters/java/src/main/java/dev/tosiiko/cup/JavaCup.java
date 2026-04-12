package dev.tosiiko.cup;

public final class JavaCup {
  public static final String ADAPTER_NAME = "java-cup";
  public static final String PROTOCOL_VERSION = "1";
  public static final String GENERATOR = "java-cup/0.1.6";

  private JavaCup() {}

  public static FetchAction fetch(String url) {
    return new FetchAction(url);
  }

  public static EmitAction emit(String event) {
    return new EmitAction(event);
  }

  public static NavigateAction navigate(String url) {
    return new NavigateAction(url);
  }

  public static ViewPolicy starterViewPolicy() {
    return ViewPolicy.starter();
  }
}
