module window_drag;

enum Cell {
    Nw,
    Ne,
    Sw,
    Se,
}

enum Step {
    East,
    West,
    North,
    South,
}

fn drag(here: Cell, step: Step) -> Cell
    ensures
        (here == Cell.Nw && step == Step.East && (result == Cell.Nw || result == Cell.Ne))
        || (here == Cell.Nw && step == Step.West && (result == Cell.Nw))
        || (here == Cell.Nw && step == Step.North && (result == Cell.Nw))
        || (here == Cell.Nw && step == Step.South && (result == Cell.Nw || result == Cell.Sw))
        || (here == Cell.Ne && step == Step.East && (result == Cell.Ne))
        || (here == Cell.Ne && step == Step.West && (result == Cell.Ne || result == Cell.Nw))
        || (here == Cell.Ne && step == Step.North && (result == Cell.Ne))
        || (here == Cell.Ne && step == Step.South && (result == Cell.Ne || result == Cell.Se))
        || (here == Cell.Sw && step == Step.East && (result == Cell.Sw || result == Cell.Se))
        || (here == Cell.Sw && step == Step.West && (result == Cell.Sw))
        || (here == Cell.Sw && step == Step.North && (result == Cell.Sw || result == Cell.Nw))
        || (here == Cell.Sw && step == Step.South && (result == Cell.Sw))
        || (here == Cell.Se && step == Step.East && (result == Cell.Se))
        || (here == Cell.Se && step == Step.West && (result == Cell.Se || result == Cell.Sw))
        || (here == Cell.Se && step == Step.North && (result == Cell.Se || result == Cell.Ne))
        || (here == Cell.Se && step == Step.South && (result == Cell.Se))
{
    return learn settle(here, step): choice<Cell> else here;
}
