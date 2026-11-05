module shade;

enum Position {
    Up,
    Down,
}

enum Gesture {
    Tap,
}

fn shade(here: Position, tap: Gesture) -> Position
    ensures
        (here == Position.Up && tap == Gesture.Tap && (result == Position.Down))
        || (here == Position.Down && tap == Gesture.Tap && (result == Position.Up))
{
    return learn settle(here, tap): choice<Position> else here;
}
